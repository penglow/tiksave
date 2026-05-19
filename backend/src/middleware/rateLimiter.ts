/**
 * HTTP rate limiters — global IP caps, per-user caps, and stricter limits on costly routes.
 */

import type { Request } from 'express';
import rateLimit, { type Options, type RateLimitRequestHandler } from 'express-rate-limit';
import { AuthenticatedRequest } from './auth.js';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

const RATE_LIMIT_MESSAGE = { error: 'Too many requests, please try again later.' };

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const value = parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function clientIp(req: Request): string {
  return req.ip || 'unknown';
}

function authenticatedUserKey(req: Request): string {
  const authReq = req as AuthenticatedRequest;
  return authReq.userId || clientIp(req);
}

interface LimiterConfig {
  /** Redis key prefix when using a shared store (future use). */
  name: string;
  windowMs: number;
  max: number;
  keyGenerator?: Options['keyGenerator'];
  skipSuccessfulRequests?: boolean;
}

function createLimiter(config: LimiterConfig): RateLimitRequestHandler {
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: RATE_LIMIT_MESSAGE,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: config.keyGenerator ?? clientIp,
    skipSuccessfulRequests: config.skipSuccessfulRequests ?? false,
  });
}

/** Broad IP cap for all /api routes (unauthenticated traffic included). */
export const globalIpLimiter = createLimiter({
  name: 'global-ip',
  windowMs: parsePositiveInt(process.env.RATE_LIMIT_WINDOW_MS, FIFTEEN_MINUTES_MS),
  max: parsePositiveInt(process.env.RATE_LIMIT_MAX_REQUESTS, 100),
});

/** Per-user cap for authenticated routers (falls back to IP before auth runs). */
export const userLimiter = createLimiter({
  name: 'user',
  windowMs: parsePositiveInt(process.env.RATE_LIMIT_WINDOW_MS, FIFTEEN_MINUTES_MS),
  max: parsePositiveInt(process.env.RATE_LIMIT_MAX_REQUESTS_USER, 500),
  keyGenerator: authenticatedUserKey,
});

/** Fallback cap on all /api/auth routes. */
export const authLimiter = createLimiter({
  name: 'auth',
  windowMs: FIFTEEN_MINUTES_MS,
  max: parsePositiveInt(process.env.RATE_LIMIT_AUTH_MAX, 30),
});

/** Brute-force protection for sign-in (failed attempts only). */
export const signInLimiter = createLimiter({
  name: 'signin',
  windowMs: FIFTEEN_MINUTES_MS,
  max: parsePositiveInt(process.env.RATE_LIMIT_SIGNIN_MAX, 10),
  skipSuccessfulRequests: true,
});

/** Limit account creation spam. */
export const signUpLimiter = createLimiter({
  name: 'signup',
  windowMs: ONE_HOUR_MS,
  max: parsePositiveInt(process.env.RATE_LIMIT_SIGNUP_MAX, 5),
});

/** Limit refresh-token abuse. */
export const refreshLimiter = createLimiter({
  name: 'refresh',
  windowMs: FIFTEEN_MINUTES_MS,
  max: parsePositiveInt(process.env.RATE_LIMIT_REFRESH_MAX, 60),
});

/** Limit password-reset email/token probing. */
export const passwordResetRequestLimiter = createLimiter({
  name: 'password-reset-request',
  windowMs: ONE_HOUR_MS,
  max: parsePositiveInt(process.env.RATE_LIMIT_PASSWORD_RESET_MAX, 5),
});

/** Limit reset-token guessing on confirm. */
export const passwordResetConfirmLimiter = createLimiter({
  name: 'password-reset-confirm',
  windowMs: FIFTEEN_MINUTES_MS,
  max: parsePositiveInt(process.env.RATE_LIMIT_PASSWORD_RESET_CONFIRM_MAX, 10),
});

/** TikTok import + batch import (processing-heavy). */
export const importLimiter = createLimiter({
  name: 'import',
  windowMs: FIFTEEN_MINUTES_MS,
  max: parsePositiveInt(process.env.RATE_LIMIT_IMPORT_MAX, 30),
  keyGenerator: authenticatedUserKey,
});

/** Video upload URL generation. */
export const uploadLimiter = createLimiter({
  name: 'upload',
  windowMs: FIFTEEN_MINUTES_MS,
  max: parsePositiveInt(process.env.RATE_LIMIT_UPLOAD_MAX, 20),
  keyGenerator: authenticatedUserKey,
});

/** Semantic / keyword search (OpenAI + embeddings). */
export const searchLimiter = createLimiter({
  name: 'search',
  windowMs: FIFTEEN_MINUTES_MS,
  max: parsePositiveInt(process.env.RATE_LIMIT_SEARCH_MAX, 60),
  keyGenerator: authenticatedUserKey,
});

/** Public health checks — prevent reconnaissance / DoS. */
export const healthLimiter = createLimiter({
  name: 'health',
  windowMs: 60 * 1000,
  max: parsePositiveInt(process.env.RATE_LIMIT_HEALTH_MAX, 30),
});

/** Unauthenticated public config endpoint. */
export const publicConfigLimiter = createLimiter({
  name: 'public-config',
  windowMs: FIFTEEN_MINUTES_MS,
  max: parsePositiveInt(process.env.RATE_LIMIT_PUBLIC_CONFIG_MAX, 60),
});
