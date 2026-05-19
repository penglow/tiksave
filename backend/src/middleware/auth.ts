/**
 * JWT authentication middleware.
 * Validates Bearer tokens and attaches the authenticated user ID to the request.
 */

// --- imports ---

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// --- types ---

/** Express request extended with authenticated user context. */
export interface AuthenticatedRequest extends Request {
  userId: string;
  requestId?: string;
}

// --- constants ---

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET || '';
  if (!secret) {
    console.error('❌ FATAL: JWT_SECRET environment variable is not set');
    process.exit(1);
  }
  return secret;
}

// --- helpers ---

function isAuthPayload(decoded: string | jwt.JwtPayload): decoded is jwt.JwtPayload & { userId: string } {
  return typeof decoded === 'object' && typeof decoded.userId === 'string';
}

// --- handlers ---

/**
 * Express middleware that requires a valid JWT access token.
 * Sets `userId` on the request when verification succeeds.
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    if (!isAuthPayload(decoded)) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    (req as AuthenticatedRequest).userId = decoded.userId;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token expired, please sign in again' });
    }
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

