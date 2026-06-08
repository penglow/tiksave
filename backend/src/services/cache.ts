/**
 * Cache service for frequently accessed data using Redis cache-aside pattern.
 */

// --- imports ---

import { getRedisClient } from './redis.js';
import { logger } from '../utils/logger.js';

// --- constants ---

/** Cache TTL in seconds by data category. */
const CACHE_TTL = {
  FOLDER_LIST: 300,      // 5 minutes
  FOLDER_DETAIL: 600,    // 10 minutes
  USER_PREFERENCES: 600, // 10 minutes
  ITEM_DETAIL: 60,       // 1 minute
  SEARCH_RESULTS: 120,   // 2 minutes
  CATEGORY_STATS: 300,   // 5 minutes
} as const;

/** Cache key prefixes by domain. */
const KEY_PREFIX = {
  FOLDERS: 'folders',
  FOLDER: 'folder',
  USER_PREFS: 'user_prefs',
  ITEM: 'item',
  SEARCH: 'search',
  CATEGORIES: 'categories',
} as const;

// --- helpers ---

/** Build a colon-separated cache key from prefix and parts. */
function generateKey(prefix: string, ...parts: string[]): string {
  return `${prefix}:${parts.join(':')}`;
}

// --- handlers ---

/** Get a cached value by key. */
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const redis = getRedisClient();
    const data = await redis.get(key);
    
    if (!data) return null;
    
    return JSON.parse(data) as T;
  } catch (error) {
    logger.error('Cache get error', error as Error, { key });
    return null;
  }
}

/**
 * Set cached value with TTL
 */
export async function setCache<T>(
  key: string, 
  value: T, 
  ttlSeconds: number
): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    logger.error('Cache set error', error as Error, { key });
  }
}

/**
 * Delete cached value
 */
export async function deleteCache(key: string): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.del(key);
  } catch (error) {
    logger.error('Cache delete error', error as Error, { key });
  }
}

/**
 * Delete multiple cache keys by pattern
 */
export async function deleteCachePattern(pattern: string): Promise<void> {
  try {
    const redis = getRedisClient();
    const keys = await redis.keys(pattern);
    
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    logger.error('Cache pattern delete error', error as Error, { pattern });
  }
}

// ===================== FOLDER CACHE =====================

/**
 * Cache user's folder list
 */
export async function cacheFolderList(
  userId: string, 
  folders: unknown[]
): Promise<void> {
  const key = generateKey(KEY_PREFIX.FOLDERS, userId);
  await setCache(key, folders, CACHE_TTL.FOLDER_LIST);
}

/**
 * Get cached folder list
 */
export async function getCachedFolderList(userId: string): Promise<unknown[] | null> {
  const key = generateKey(KEY_PREFIX.FOLDERS, userId);
  return getCache<unknown[]>(key);
}

/**
 * Invalidate folder list cache
 */
export async function invalidateFolderList(userId: string): Promise<void> {
  const key = generateKey(KEY_PREFIX.FOLDERS, userId);
  await deleteCache(key);
}

/**
 * Cache single folder
 */
export async function cacheFolder(
  folderId: string, 
  folder: unknown
): Promise<void> {
  const key = generateKey(KEY_PREFIX.FOLDER, folderId);
  await setCache(key, folder, CACHE_TTL.FOLDER_DETAIL);
}

/**
 * Get cached folder
 */
export async function getCachedFolder(folderId: string): Promise<unknown | null> {
  const key = generateKey(KEY_PREFIX.FOLDER, folderId);
  return getCache<unknown>(key);
}

/**
 * Invalidate folder cache
 */
export async function invalidateFolder(folderId: string): Promise<void> {
  const key = generateKey(KEY_PREFIX.FOLDER, folderId);
  await deleteCache(key);
}

// ===================== USER PREFERENCES CACHE =====================

/**
 * Cache user preferences
 */
export async function cacheUserPreferences(
  userId: string, 
  preferences: unknown
): Promise<void> {
  const key = generateKey(KEY_PREFIX.USER_PREFS, userId);
  await setCache(key, preferences, CACHE_TTL.USER_PREFERENCES);
}

/**
 * Get cached user preferences
 */
export async function getCachedUserPreferences(userId: string): Promise<unknown | null> {
  const key = generateKey(KEY_PREFIX.USER_PREFS, userId);
  return getCache<unknown>(key);
}

/**
 * Invalidate user preferences cache
 */
export async function invalidateUserPreferences(userId: string): Promise<void> {
  const key = generateKey(KEY_PREFIX.USER_PREFS, userId);
  await deleteCache(key);
}

// ===================== ITEM CACHE =====================

/**
 * Cache item detail
 */
export async function cacheItem(
  itemId: string, 
  item: unknown
): Promise<void> {
  const key = generateKey(KEY_PREFIX.ITEM, itemId);
  await setCache(key, item, CACHE_TTL.ITEM_DETAIL);
}

/**
 * Get cached item
 */
export async function getCachedItem(itemId: string): Promise<unknown | null> {
  const key = generateKey(KEY_PREFIX.ITEM, itemId);
  return getCache<unknown>(key);
}

/**
 * Invalidate item cache
 */
export async function invalidateItem(itemId: string): Promise<void> {
  const key = generateKey(KEY_PREFIX.ITEM, itemId);
  await deleteCache(key);
}

// ===================== SEARCH CACHE =====================

/**
 * Cache search results
 */
export async function cacheSearchResults(
  userId: string,
  query: string,
  results: unknown[]
): Promise<void> {
  // Create hash of query for cache key
  const queryHash = Buffer.from(query).toString('base64url');
  const key = generateKey(KEY_PREFIX.SEARCH, userId, queryHash);
  await setCache(key, results, CACHE_TTL.SEARCH_RESULTS);
}

/**
 * Get cached search results
 */
export async function getCachedSearchResults(
  userId: string,
  query: string
): Promise<unknown[] | null> {
  const queryHash = Buffer.from(query).toString('base64url');
  const key = generateKey(KEY_PREFIX.SEARCH, userId, queryHash);
  return getCache<unknown[]>(key);
}

/**
 * Invalidate search cache for user
 */
export async function invalidateSearchCache(userId: string): Promise<void> {
  const pattern = generateKey(KEY_PREFIX.SEARCH, userId, '*');
  await deleteCachePattern(pattern);
}

// ===================== CACHE STATISTICS =====================

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  keys: number;
  hits: number;
  misses: number;
}> {
  try {
    const redis = getRedisClient();
    const info = await redis.info('stats');
    
    // Parse keyspace hits and misses from info
    const hitsMatch = info.match(/keyspace_hits:(\d+)/);
    const missesMatch = info.match(/keyspace_misses:(\d+)/);
    
    const keys = await redis.dbsize();
    
    return {
      keys,
      hits: hitsMatch ? parseInt(hitsMatch[1], 10) : 0,
      misses: missesMatch ? parseInt(missesMatch[1], 10) : 0,
    };
  } catch (error) {
    logger.error('Cache stats error', error as Error);
    return { keys: 0, hits: 0, misses: 0 };
  }
}

/**
 * Clear all cache
 */
export async function clearAllCache(): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.flushdb();
    logger.info('All cache cleared');
  } catch (error) {
    logger.error('Cache clear error', error as Error);
  }
}
