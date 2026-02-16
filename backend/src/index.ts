import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

import { authRouter } from './routes/auth.js';
import { itemsRouter } from './routes/items.js';
import { foldersRouter } from './routes/folders.js';
import { searchRouter } from './routes/search.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authenticate, AuthenticatedRequest } from './middleware/auth.js';
import { initializeDatabase, pool } from './database/init.js';
import { startWorker, shutdownWorker } from './workers/videoProcessor.js';
import { getRedisClient, isRedisHealthy, closeRedisConnections } from './services/redis.js';
import { getCacheStats } from './services/cache.js';
import { logger, createRequestLogger } from './utils/logger.js';

dotenv.config();

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false, // Disable for development
}));

// CORS configuration - use CORS_ORIGINS env var in production
const getCorsOrigins = (): string[] | boolean => {
  if (process.env.NODE_ENV !== 'production') {
    return true; // Allow all origins in development
  }
  
  const corsOrigins = process.env.CORS_ORIGINS;
  if (!corsOrigins) {
    logger.warn('CORS_ORIGINS not configured for production, using restrictive default');
    return ['https://localhost']; // Restrictive default
  }
  
  // Parse comma-separated origins
  return corsOrigins.split(',').map((origin) => origin.trim()).filter(Boolean);
};

app.use(cors({
  origin: getCorsOrigins(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Compression middleware - reduces response size by 70-80%
app.use(compression({
  filter: (req, res) => {
    // Don't compress responses with small payloads (< 1KB)
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Use compression filter function
    return compression.filter(req, res);
  },
  level: 6, // Balance between compression ratio and speed (1-9)
  threshold: 1024, // Only compress responses larger than 1KB
}));

// Rate limiting - supports both IP-based and user-based limiting
const createRateLimiter = (options: { windowMs: number; max: number; keyGenerator?: (req: express.Request) => string }) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: options.keyGenerator || ((req) => req.ip || 'unknown'),
  });
};

// IP-based rate limiting for unauthenticated routes (auth endpoints)
const ipLimiter = createRateLimiter({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
});

// User-based rate limiting for authenticated routes (higher limits)
const userLimiter = createRateLimiter({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS_USER || '500'), // Higher limit for authenticated users
  keyGenerator: (req) => {
    // Use userId if available, otherwise fall back to IP
    const authReq = req as AuthenticatedRequest;
    return authReq.userId || req.ip || 'unknown';
  },
});

// Strict rate limiting for auth endpoints to prevent brute force
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per 15 minutes
});

// Apply IP limiter to all API routes as baseline
app.use('/api', ipLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request ID tracking
app.use((req, res, next) => {
  req.requestId = uuidv4();
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

// Request logging with structured logger
app.use((req, res, next) => {
  const start = Date.now();
  const requestLogger = createRequestLogger(req.requestId || 'unknown');
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    
    requestLogger[logLevel](`${req.method} ${req.url}`, {
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  });
  next();
});

// Health check with dependency status (reuses existing Redis connection)
app.get('/health', async (req, res) => {
  const startedAt = process.hrtime.bigint();
  const checks: {
    db: boolean;
    redis: boolean;
    openai: boolean;
    timestamp: string;
    uptime: number;
    version: string;
  } = {
    db: false,
    redis: false,
    openai: false,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.APP_VERSION || '1.0.0',
  };

  // Check database connection
  try {
    const result = await pool.query('SELECT 1');
    checks.db = result.rows.length > 0;
  } catch (error) {
    logger.error('Health check - DB failed', error as Error);
  }

  // Check Redis connection (reuse existing client)
  try {
    const redisHealthy = await isRedisHealthy();
    checks.redis = redisHealthy;
  } catch (error) {
    logger.error('Health check - Redis failed', error as Error);
  }

  // Check OpenAI availability (lightweight check)
  checks.openai = !!process.env.OPENAI_API_KEY;

  // Core services (DB + Redis) must be healthy
  const isHealthy = checks.db && checks.redis;
  // OpenAI being down degrades functionality but doesn't fail the app
  const status = isHealthy ? (checks.openai ? 'ok' : 'degraded') : 'unhealthy';
  const responseTimeMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

  res.status(isHealthy ? 200 : 503).json({
    status,
    ...checks,
    responseTimeMs: Math.round(responseTimeMs * 100) / 100,
  });
});

// API Routes
// Auth routes have stricter rate limiting
app.use('/api/auth', authLimiter, authRouter);
// Authenticated routes use user-based rate limiting
app.use('/api/items', authenticate, userLimiter, itemsRouter);
app.use('/api/folders', authenticate, userLimiter, foldersRouter);
app.use('/api/search', authenticate, userLimiter, searchRouter);

// Lightweight cache metrics endpoint (disabled in production unless explicitly enabled)
app.get('/api/metrics/cache', authenticate, userLimiter, async (req, res) => {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_METRICS_ENDPOINT !== 'true') {
    return res.status(404).json({ error: 'Not found' });
  }

  const stats = await getCacheStats();
  const total = stats.hits + stats.misses;
  const hitRate = total > 0 ? stats.hits / total : 0;

  res.json({
    cache: {
      ...stats,
      hitRate: Number(hitRate.toFixed(4)),
    },
    timestamp: new Date().toISOString(),
  });
});

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
async function start() {
  try {
    // Initialize database
    await initializeDatabase();
    logger.info('Database initialized');

    // Initialize Redis connection
    getRedisClient();
    logger.info('Redis client initialized');

    // Start background worker
    startWorker();
    logger.info('Background worker started');

    // Start HTTP server
    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server running`, { port: PORT, url: `http://localhost:${PORT}` });
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);
      
      server.close(async () => {
        logger.info('HTTP server closed');
        
        // Shutdown worker queue first (may have pending jobs)
        try {
          await shutdownWorker();
          logger.info('Worker queue closed');
        } catch (error) {
          logger.error('Error closing worker queue', error as Error);
        }
        
        try {
          await closeRedisConnections();
          logger.info('Redis connections closed');
        } catch (error) {
          logger.error('Error closing Redis connections', error as Error);
        }
        
        try {
          await pool.end();
          logger.info('Database pool closed');
        } catch (error) {
          logger.error('Error closing database pool', error as Error);
        }
        
        process.exit(0);
      });
      
      // Force exit after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

start();
