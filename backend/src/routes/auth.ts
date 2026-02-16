import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import { query } from '../database/init.js';
import { AppError } from '../middleware/errorHandler.js';
import { sanitizeEmail, sanitizeString } from '../utils/sanitize.js';
import { logger } from '../utils/logger.js';

export const authRouter = Router();

const ACCESS_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
const ALLOW_DEV_RESET_TOKEN_RESPONSE =
  process.env.NODE_ENV === 'development' &&
  process.env.ALLOW_DEV_PASSWORD_RESET_TOKEN === 'true';

if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_PASSWORD_RESET_TOKEN === 'true') {
  throw new Error('ALLOW_DEV_PASSWORD_RESET_TOKEN must never be enabled in production');
}

// Validation schemas
const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().optional(),
});

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Sign up
authRouter.post('/signup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = signUpSchema.parse(req.body);
    
    // Sanitize inputs
    const email = sanitizeEmail(parsed.email);
    if (!email) {
      throw new AppError('Invalid email format', 400);
    }
    const password = parsed.password;
    const displayName = parsed.displayName 
      ? sanitizeString(parsed.displayName, { maxLength: 255, allowNewlines: false }) 
      : undefined;
    
    // Check if user exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      throw new AppError('Email already registered', 400);
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Create user
    const result = await query(
      `INSERT INTO users (email, password_hash, display_name, settings) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, email, display_name, avatar_url, settings, created_at`,
      [email, passwordHash, displayName, JSON.stringify({
        enableVideoUpload: true,
        autoFileHighConfidence: true,
        notificationsEnabled: true,
        confidenceThreshold: 0.85,
        defaultInboxRetention: 30,
        theme: 'system'
      })]
    );
    
    const user = result.rows[0];
    
    // Create default folders
    await createDefaultFolders(user.id);
    
    // Generate tokens
    const tokens = await generateTokens(user.id);
    
    res.status(201).json({
      user: formatUser(user),
      ...tokens,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    next(error);
  }
});

// Sign in
authRouter.post('/signin', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = signInSchema.parse(req.body);
    
    // Sanitize email
    const email = sanitizeEmail(parsed.email);
    if (!email) {
      throw new AppError('Invalid email or password', 401);
    }
    const password = parsed.password;
    
    // Find user
    const result = await query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length === 0) {
      throw new AppError('Invalid email or password', 401);
    }
    
    const user = result.rows[0];
    
    // Check password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw new AppError('Invalid email or password', 401);
    }
    
    // Generate tokens
    const tokens = await generateTokens(user.id);
    
    res.json({
      user: formatUser(user),
      ...tokens,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    next(error);
  }
});

// Refresh token
authRouter.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      throw new AppError('Refresh token required', 400);
    }
    
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET!) as {
      userId: string; 
      type: string;
    };
    
    if (decoded.type !== 'refresh') {
      throw new AppError('Invalid token type', 401);
    }
    
    // Get user
    const result = await query(
      'SELECT * FROM users WHERE id = $1',
      [decoded.userId]
    );
    
    if (result.rows.length === 0) {
      throw new AppError('User not found', 404);
    }
    
    const incomingTokenHash = hashToken(refreshToken);
    const existingRefresh = await query(
      `SELECT id FROM refresh_tokens
       WHERE token_hash = $1
         AND user_id = $2
         AND revoked_at IS NULL
         AND expires_at > NOW()`,
      [incomingTokenHash, decoded.userId]
    );

    if (existingRefresh.rows.length === 0) {
      throw new AppError('Invalid token', 401);
    }

    const tokens = await generateTokens(decoded.userId);
    const replacementHash = hashToken(tokens.refreshToken);

    const revokeResult = await query(
      `UPDATE refresh_tokens
       SET revoked_at = NOW(), replaced_by_token_hash = $2
       WHERE token_hash = $1
         AND user_id = $3
         AND revoked_at IS NULL`,
      [incomingTokenHash, replacementHash, decoded.userId]
    );

    if ((revokeResult.rowCount || 0) === 0) {
      await revokeRefreshToken(replacementHash);
      throw new AppError('Invalid token', 401);
    }
    
    res.json({
      user: formatUser(result.rows[0]),
      ...tokens,
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    next(error);
  }
});

// Password reset schemas
const requestPasswordResetSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

// Request password reset - generates a reset token
authRouter.post('/password-reset/request', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = requestPasswordResetSchema.parse(req.body);
    const email = sanitizeEmail(parsed.email);
    
    if (!email) {
      // Don't reveal if email exists
      return res.json({ message: 'If the email exists, a reset link will be sent.' });
    }
    
    // Find user
    const result = await query('SELECT id, email FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      // Don't reveal if email exists - same response
      logger.info('Password reset requested for non-existent email', { email });
      return res.json({ message: 'If the email exists, a reset link will be sent.' });
    }
    
    const user = result.rows[0];
    
    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    
    // Store hashed token in database
    await query(
      `UPDATE users SET 
        settings = settings || $1::jsonb,
        updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify({ 
        passwordResetToken: resetTokenHash,
        passwordResetExpiry: resetTokenExpiry.toISOString()
      }), user.id]
    );
    
    logger.info('Password reset token generated', { userId: user.id });
    
    // In production, this would send an email with the reset link
    // For development, return the token (remove this in production!)
    if (ALLOW_DEV_RESET_TOKEN_RESPONSE) {
      return res.json({ 
        message: 'If the email exists, a reset link will be sent.',
        // DEV ONLY: Include token for testing
        _devToken: resetToken,
        _devResetUrl: `${process.env.FRONTEND_URL || 'http://localhost:8081'}/reset-password?token=${resetToken}`
      });
    }
    
    // TODO: Integrate with email service (SendGrid, SES, etc.)
    // await sendPasswordResetEmail(user.email, resetToken);
    
    res.json({ message: 'If the email exists, a reset link will be sent.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    next(error);
  }
});

// Reset password with token
authRouter.post('/password-reset/confirm', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = resetPasswordSchema.parse(req.body);
    
    // Hash the provided token
    const tokenHash = crypto.createHash('sha256').update(parsed.token).digest('hex');
    
    // Find user with matching token that hasn't expired
    const result = await query(
      `SELECT id, email, settings FROM users 
       WHERE settings->>'passwordResetToken' = $1
       AND (settings->>'passwordResetExpiry')::timestamp > NOW()`,
      [tokenHash]
    );
    
    if (result.rows.length === 0) {
      throw new AppError('Invalid or expired reset token', 400);
    }
    
    const user = result.rows[0];
    
    // Hash new password
    const passwordHash = await bcrypt.hash(parsed.newPassword, 12);
    
    // Update password and clear reset token
    const currentSettings = user.settings || {};
    delete currentSettings.passwordResetToken;
    delete currentSettings.passwordResetExpiry;
    
    await query(
      `UPDATE users SET 
        password_hash = $1,
        settings = $2,
        updated_at = NOW()
       WHERE id = $3`,
      [passwordHash, JSON.stringify(currentSettings), user.id]
    );
    
    logger.info('Password reset completed', { userId: user.id });
    
    // Generate new tokens for automatic login
    await revokeAllUserRefreshTokens(user.id);
    const tokens = await generateTokens(user.id);
    
    res.json({
      message: 'Password reset successful',
      ...tokens,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    next(error);
  }
});

// Helper functions
function parseExpiresIn(expiresIn: string): number {
  // Parse duration string like '7d', '24h', '30m' into milliseconds
  const match = expiresIn.match(/^(\d+)([dhms])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // Default 7 days
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  switch (unit) {
    case 'd': return value * 24 * 60 * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'm': return value * 60 * 1000;
    case 's': return value * 1000;
    default: return 7 * 24 * 60 * 60 * 1000;
  }
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function storeRefreshToken(userId: string, refreshToken: string, expiresAt: Date): Promise<void> {
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, hashToken(refreshToken), expiresAt]
  );
}

async function revokeRefreshToken(tokenHash: string): Promise<void> {
  await query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE token_hash = $1
       AND revoked_at IS NULL`,
    [tokenHash]
  );
}

async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  await query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE user_id = $1
       AND revoked_at IS NULL`,
    [userId]
  );
}

async function generateTokens(userId: string) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not configured');
  }
  
  const expiresIn = ACCESS_EXPIRES_IN;
  // @ts-expect-error - jsonwebtoken types are incorrect for expiresIn string values
  const accessToken = jwt.sign(
    { userId },
    jwtSecret,
    { expiresIn }
  );
  
  const refreshJti = crypto.randomUUID();
  const refreshToken = jwt.sign(
    { userId, type: 'refresh', jti: refreshJti },
    jwtSecret,
    { expiresIn: REFRESH_EXPIRES_IN }
  );
  
  // Calculate expiresAt based on actual expiresIn value
  const expiresAt = new Date(Date.now() + parseExpiresIn(expiresIn));
  const refreshExpiresAt = new Date(Date.now() + parseExpiresIn(REFRESH_EXPIRES_IN));
  await storeRefreshToken(userId, refreshToken, refreshExpiresAt);
  
  return { accessToken, refreshToken, expiresAt };
}

function formatUser(row: any) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarURL: row.avatar_url,
    createdAt: row.created_at,
    settings: row.settings,
  };
}

async function createDefaultFolders(userId: string) {
  const defaultFolders = [
    { name: 'Japan', icon: '🇯🇵', children: [
      { name: 'Japan Food', icon: '🍜' },
      { name: 'Japan Hotels', icon: '🏨' },
      { name: 'Japan Attractions', icon: '⛩️' },
      { name: 'Japan Shopping', icon: '🛍️' },
    ]},
    { name: 'Gym', icon: '💪', children: [
      { name: 'Workouts', icon: '🏋️' },
      { name: 'Nutrition', icon: '🥗' },
    ]},
    { name: 'Recipes', icon: '👨‍🍳', children: [
      { name: 'Quick Meals', icon: '⏱️' },
      { name: 'Desserts', icon: '🍰' },
    ]},
  ];
  
  for (let i = 0; i < defaultFolders.length; i++) {
    const folder = defaultFolders[i];
    
    // Create parent folder
    const parentResult = await query(
      `INSERT INTO folders (user_id, name, icon_name, sort_order, is_default)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id`,
      [userId, folder.name, folder.icon, i]
    );
    
    const parentId = parentResult.rows[0].id;
    
    // Create children
    for (let j = 0; j < folder.children.length; j++) {
      const child = folder.children[j];
      await query(
        `INSERT INTO folders (user_id, name, parent_id, icon_name, sort_order, is_default)
         VALUES ($1, $2, $3, $4, $5, true)`,
        [userId, child.name, parentId, child.icon, j]
      );
    }
  }
}
