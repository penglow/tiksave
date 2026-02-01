import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';

/**
 * Validation error response format
 */
interface ValidationErrorResponse {
  error: string;
  field?: string;
  details?: Array<{ path: string; message: string }>;
}

/**
 * Format Zod validation errors into a user-friendly response
 */
function formatZodError(error: ZodError): ValidationErrorResponse {
  const firstError = error.errors[0];
  const path = firstError.path.join('.');
  
  return {
    error: firstError.message,
    field: path || undefined,
    details: error.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    })),
  };
}

/**
 * Middleware factory for validating request body
 * 
 * Usage:
 * router.post('/endpoint', validateBody(mySchema), handler);
 */
export function validateBody<T extends ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json(formatZodError(error));
      }
      next(error);
    }
  };
}

/**
 * Middleware factory for validating request query parameters
 * 
 * Usage:
 * router.get('/endpoint', validateQuery(mySchema), handler);
 */
export function validateQuery<T extends ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query) as typeof req.query;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json(formatZodError(error));
      }
      next(error);
    }
  };
}

/**
 * Middleware factory for validating request params
 * 
 * Usage:
 * router.get('/endpoint/:id', validateParams(mySchema), handler);
 */
export function validateParams<T extends ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = schema.parse(req.params) as typeof req.params;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json(formatZodError(error));
      }
      next(error);
    }
  };
}

/**
 * Combined validation for body, query, and params
 * 
 * Usage:
 * router.post('/endpoint/:id', validate({
 *   body: bodySchema,
 *   query: querySchema,
 *   params: paramsSchema,
 * }), handler);
 */
export function validate<
  TBody extends ZodSchema = ZodSchema,
  TQuery extends ZodSchema = ZodSchema,
  TParams extends ZodSchema = ZodSchema,
>(schemas: {
  body?: TBody;
  query?: TQuery;
  params?: TParams;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query) as typeof req.query;
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as typeof req.params;
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json(formatZodError(error));
      }
      next(error);
    }
  };
}

/**
 * Common validation schemas for reuse across routes
 */
export const CommonSchemas = {
  // UUID parameter
  uuid: z.string().uuid('Invalid UUID format'),
  
  // Pagination query params
  pagination: z.object({
    limit: z.string().optional().transform((v) => {
      const num = parseInt(v || '50', 10);
      return Math.max(1, Math.min(100, isNaN(num) ? 50 : num));
    }),
    offset: z.string().optional().transform((v) => {
      const num = parseInt(v || '0', 10);
      return Math.max(0, isNaN(num) ? 0 : num);
    }),
  }),
  
  // ID param
  idParam: z.object({
    id: z.string().uuid('Invalid ID format'),
  }),
  
  // Email validation
  email: z.string().email('Invalid email format').toLowerCase().trim(),
  
  // Password validation
  password: z.string().min(8, 'Password must be at least 8 characters'),
  
  // URL validation
  url: z.string().url('Invalid URL format'),
  
  // Color hex validation
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format (use #RRGGBB)'),
};

/**
 * Helper to parse and validate Zod schema with detailed error handling
 * For use in handlers where middleware approach isn't suitable
 */
export function parseOrThrow<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const formatted = formatZodError(result.error);
    const error = new Error(formatted.error) as Error & { statusCode: number; field?: string };
    error.statusCode = 400;
    error.field = formatted.field;
    throw error;
  }
  return result.data;
}
