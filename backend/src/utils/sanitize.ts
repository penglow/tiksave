/**
 * Input sanitization utilities
 * Helps prevent XSS and other injection attacks
 */

// HTML entities to escape
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(str: string): string {
  return str.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Remove HTML tags from a string
 */
export function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '');
}

/**
 * Sanitize a string for safe storage and display
 * - Strips HTML tags
 * - Normalizes whitespace
 * - Trims leading/trailing whitespace
 * - Limits length
 */
export function sanitizeString(
  str: string | null | undefined,
  options: {
    maxLength?: number;
    allowNewlines?: boolean;
    escapeHtml?: boolean;
  } = {}
): string {
  if (!str) return '';
  
  const { maxLength, allowNewlines = true, escapeHtml: shouldEscape = false } = options;
  
  let result = str;
  
  // Strip HTML tags
  result = stripHtml(result);
  
  // Normalize whitespace
  if (allowNewlines) {
    // Replace multiple spaces/tabs with single space, but keep newlines
    result = result.replace(/[^\S\n]+/g, ' ');
    // Normalize multiple newlines to max 2
    result = result.replace(/\n{3,}/g, '\n\n');
  } else {
    // Replace all whitespace including newlines with single space
    result = result.replace(/\s+/g, ' ');
  }
  
  // Trim
  result = result.trim();
  
  // Escape HTML if requested
  if (shouldEscape) {
    result = escapeHtml(result);
  }
  
  // Limit length
  if (maxLength && result.length > maxLength) {
    result = result.slice(0, maxLength);
  }
  
  return result;
}

/**
 * Sanitize a URL
 * - Validates URL format
 * - Only allows http/https protocols
 * - Removes dangerous characters
 */
export function sanitizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  
  try {
    const parsed = new URL(url.trim());
    
    // Only allow http and https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    
    // Return the normalized URL
    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * Sanitize user-generated content (e.g., from TikTok)
 * More permissive than sanitizeString but still safe
 */
export function sanitizeUserContent(
  content: string | null | undefined,
  maxLength: number = 5000
): string {
  if (!content) return '';
  
  let result = content;
  
  // Remove potentially dangerous script tags and event handlers
  result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  result = result.replace(/\bon\w+\s*=/gi, '');
  
  // Strip HTML but preserve the text content
  result = stripHtml(result);
  
  // Normalize whitespace but preserve newlines
  result = result.replace(/[^\S\n]+/g, ' ');
  result = result.replace(/\n{3,}/g, '\n\n');
  
  // Trim and limit length
  result = result.trim();
  if (result.length > maxLength) {
    result = result.slice(0, maxLength);
  }
  
  return result;
}

/**
 * Sanitize an email address
 */
export function sanitizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  
  // Basic cleanup
  const cleaned = email.toLowerCase().trim();
  
  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleaned)) {
    return null;
  }
  
  return cleaned;
}

/**
 * Sanitize a username (alphanumeric, underscores, dots, hyphens)
 */
export function sanitizeUsername(username: string | null | undefined): string {
  if (!username) return '';
  
  // Remove any character that's not alphanumeric, underscore, dot, or hyphen
  return username.replace(/[^\w.-]/g, '').slice(0, 50);
}

/**
 * Remove null bytes and other dangerous characters from strings
 * Useful for preventing null byte injection attacks
 */
export function removeNullBytes(str: string): string {
  return str.replace(/\0/g, '');
}

/**
 * Sanitize object keys and string values recursively
 * Useful for sanitizing entire request bodies
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  options: {
    maxStringLength?: number;
    maxDepth?: number;
  } = {}
): T {
  const { maxStringLength = 10000, maxDepth = 10 } = options;
  
  function sanitizeValue(value: unknown, depth: number): unknown {
    if (depth > maxDepth) return null;
    
    if (typeof value === 'string') {
      return sanitizeString(value, { maxLength: maxStringLength });
    }
    
    if (Array.isArray(value)) {
      return value.map((item) => sanitizeValue(item, depth + 1));
    }
    
    if (value !== null && typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        const sanitizedKey = sanitizeString(key, { maxLength: 100, allowNewlines: false });
        result[sanitizedKey] = sanitizeValue(val, depth + 1);
      }
      return result;
    }
    
    return value;
  }
  
  return sanitizeValue(obj, 0) as T;
}
