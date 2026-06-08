/**
 * Shared OpenAI client singleton with retry helpers.
 */

// --- imports ---

import OpenAI from 'openai';

// --- constants ---

let openaiClient: OpenAI | null = null;

// --- handlers ---

/**
 * Get the shared OpenAI client instance.
 * Creates a new instance if one doesn't exist.
 */
export function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not configured');
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

/**
 * Check if OpenAI is configured
 */
export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Retry wrapper for OpenAI API calls with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    retryableErrors?: string[];
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    retryableErrors = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'rate_limit_exceeded', '429', '500', '502', '503', '504'],
  } = options;

  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Check if error is retryable
      const errorMessage = (error as Error).message || '';
      const errorCode = (error as any).code || '';
      const statusCode = (error as any).status?.toString() || '';
      
      const isRetryable = retryableErrors.some(
        (e) => errorMessage.includes(e) || errorCode.includes(e) || statusCode === e
      );
      
      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }
      
      // Calculate delay with exponential backoff and jitter
      const baseDelay = Math.min(initialDelayMs * Math.pow(2, attempt), maxDelayMs);
      const jitter = Math.random() * 0.3 * baseDelay; // 0-30% jitter
      const delay = baseDelay + jitter;
      
      console.log(`⚠️ OpenAI API call failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${Math.round(delay)}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}
