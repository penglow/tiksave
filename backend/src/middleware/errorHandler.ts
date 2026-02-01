import { Request, Response, NextFunction } from 'express';
import { logger, createRequestLogger } from '../utils/logger.js';

export class AppError extends Error {
  statusCode: number;
  code?: string;
  
  constructor(message: string, statusCode: number = 500, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Create request-scoped logger with context
  const requestId = (req as any).requestId || 'unknown';
  const log = createRequestLogger(requestId, (req as any).userId);
  
  // Log error with full context
  log.error('Request error', err, {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
  }
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: err.message,
      code: 'VALIDATION_ERROR',
    });
  }
  
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token',
      code: 'INVALID_TOKEN',
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired',
      code: 'TOKEN_EXPIRED',
    });
  }
  
  // PostgreSQL unique constraint violation
  if ((err as any).code === '23505') {
    return res.status(409).json({
      error: 'Resource already exists',
      code: 'DUPLICATE_ERROR',
    });
  }
  
  // PostgreSQL foreign key violation
  if ((err as any).code === '23503') {
    return res.status(400).json({
      error: 'Referenced resource not found',
      code: 'FOREIGN_KEY_ERROR',
    });
  }
  
  // Default error - hide details in production
  return res.status(500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    code: 'INTERNAL_ERROR',
  });
}

