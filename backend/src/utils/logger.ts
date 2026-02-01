/**
 * Structured logging utility
 * Provides consistent log formatting with levels, timestamps, and context
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  requestId?: string;
  userId?: string;
  itemId?: string;
  folderId?: string;
  duration?: number;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// Log level hierarchy for filtering
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Get minimum log level from environment
function getMinLogLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel;
  if (envLevel && LOG_LEVELS[envLevel] !== undefined) {
    return envLevel;
  }
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

// Format log entry for output
function formatLogEntry(entry: LogEntry): string {
  if (process.env.LOG_FORMAT === 'json') {
    return JSON.stringify(entry);
  }

  // Human-readable format for development
  const { timestamp, level, message, context, error } = entry;
  const levelEmoji: Record<LogLevel, string> = {
    debug: '🔍',
    info: 'ℹ️',
    warn: '⚠️',
    error: '❌',
  };

  let output = `[${timestamp}] ${levelEmoji[level]} [${level.toUpperCase()}] ${message}`;

  if (context && Object.keys(context).length > 0) {
    const contextStr = Object.entries(context)
      .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join(' ');
    output += ` | ${contextStr}`;
  }

  if (error) {
    output += `\n  Error: ${error.name}: ${error.message}`;
    if (error.stack && process.env.NODE_ENV !== 'production') {
      output += `\n${error.stack}`;
    }
  }

  return output;
}

// Write log entry
function writeLog(entry: LogEntry): void {
  const minLevel = getMinLogLevel();
  if (LOG_LEVELS[entry.level] < LOG_LEVELS[minLevel]) {
    return;
  }

  const formatted = formatLogEntry(entry);

  switch (entry.level) {
    case 'error':
      console.error(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    default:
      console.log(formatted);
  }
}

/**
 * Logger class for creating scoped loggers with persistent context
 */
export class Logger {
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.context = context;
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: LogContext): Logger {
    return new Logger({ ...this.context, ...additionalContext });
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.context, ...context },
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    writeLog(entry);
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext, error?: Error): void {
    this.log('warn', message, context, error);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.log('error', message, context, error);
  }
}

// Default logger instance
export const logger = new Logger();

/**
 * Create a request-scoped logger
 */
export function createRequestLogger(requestId: string, userId?: string): Logger {
  return new Logger({ requestId, userId });
}

/**
 * Timing utility for measuring operation duration
 */
export function createTimer(): { elapsed: () => number; log: (logger: Logger, message: string, context?: LogContext) => void } {
  const start = Date.now();
  return {
    elapsed: () => Date.now() - start,
    log: (log: Logger, message: string, context?: LogContext) => {
      log.info(message, { ...context, duration: Date.now() - start });
    },
  };
}

/**
 * Log an async operation with automatic timing
 */
export async function logOperation<T>(
  log: Logger,
  operationName: string,
  operation: () => Promise<T>,
  context?: LogContext
): Promise<T> {
  const timer = createTimer();
  log.debug(`Starting: ${operationName}`, context);

  try {
    const result = await operation();
    timer.log(log, `Completed: ${operationName}`, context);
    return result;
  } catch (error) {
    log.error(`Failed: ${operationName}`, error as Error, { ...context, duration: timer.elapsed() });
    throw error;
  }
}
