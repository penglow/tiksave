import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { z } from 'zod';
import { query } from '../database/init.js';
import { AppError } from '../middleware/errorHandler.js';

export const authRouter = Router();

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
authRouter.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, displayName } = signUpSchema.parse(req.body);
    
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
    const tokens = generateTokens(user.id);
    
    res.status(201).json({
      user: formatUser(user),
      ...tokens,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    throw error;
  }
});

// Sign in
authRouter.post('/signin', async (req: Request, res: Response) => {
  try {
    const { email, password } = signInSchema.parse(req.body);
    
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
    const tokens = generateTokens(user.id);
    
    res.json({
      user: formatUser(user),
      ...tokens,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    throw error;
  }
});

// Refresh token
authRouter.post('/refresh', async (req: Request, res: Response) => {
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
    
    const tokens = generateTokens(decoded.userId);
    
    res.json({
      user: formatUser(result.rows[0]),
      ...tokens,
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    throw error;
  }
});

// Helper functions
function generateTokens(userId: string) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not configured');
  }
  
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  // @ts-expect-error - jsonwebtoken types are incorrect for expiresIn string values
  const accessToken = jwt.sign(
    { userId },
    jwtSecret,
    { expiresIn }
  );
  
  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    jwtSecret,
    { expiresIn: '30d' }
  );
  
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  
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

