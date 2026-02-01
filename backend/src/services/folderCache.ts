import { RedisCache } from './redis.js';
import { query } from '../database/init.js';
import { FolderRow, FormattedFolder } from '../types/database.js';

// Cache TTL: 5 minutes (folders rarely change)
const FOLDER_CACHE_TTL = 300;

const folderCache = new RedisCache('folders', FOLDER_CACHE_TTL);

/**
 * Format a folder row for API response
 */
export function formatFolder(row: FolderRow): FormattedFolder {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    iconName: row.icon_name,
    colorHex: row.color_hex,
    sortOrder: row.sort_order,
    isDefault: row.is_default,
    rules: row.rules,
    itemCount: parseInt(row.item_count || '0', 10),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Get all folders for a user (with caching)
 */
export async function getUserFolders(userId: string): Promise<FormattedFolder[]> {
  const cacheKey = `user:${userId}:all`;
  
  // Try cache first
  const cached = await folderCache.get<FormattedFolder[]>(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Fetch from database
  const result = await query(
    `SELECT f.*, 
      (SELECT COUNT(*) FROM save_items WHERE folder_id = f.id) as item_count
     FROM folders f
     WHERE f.user_id = $1
     ORDER BY f.sort_order, f.name`,
    [userId]
  );
  
  const folders = result.rows.map(formatFolder);
  
  // Cache the result
  await folderCache.set(cacheKey, folders);
  
  return folders;
}

/**
 * Get a single folder by ID (with caching)
 */
export async function getFolderById(folderId: string, userId: string): Promise<FormattedFolder | null> {
  const cacheKey = `folder:${folderId}`;
  
  // Try cache first
  const cached = await folderCache.get<FormattedFolder>(cacheKey);
  if (cached && cached.id === folderId) {
    return cached;
  }
  
  // Fetch from database
  const result = await query(
    `SELECT f.*, 
      (SELECT COUNT(*) FROM save_items WHERE folder_id = f.id) as item_count
     FROM folders f
     WHERE f.id = $1 AND f.user_id = $2`,
    [folderId, userId]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const folder = formatFolder(result.rows[0]);
  
  // Cache the result
  await folderCache.set(cacheKey, folder);
  
  return folder;
}

/**
 * Invalidate folder cache for a user
 * Call this when folders are created, updated, or deleted
 */
export async function invalidateUserFolderCache(userId: string): Promise<void> {
  await folderCache.invalidatePattern(`user:${userId}:*`);
}

/**
 * Invalidate a specific folder's cache
 */
export async function invalidateFolderCache(folderId: string): Promise<void> {
  await folderCache.delete(`folder:${folderId}`);
}

/**
 * Invalidate all folder-related cache for a user
 */
export async function invalidateAllFolderCache(userId: string): Promise<void> {
  await folderCache.invalidatePattern(`user:${userId}:*`);
  // Note: Individual folder caches (folder:*) will expire naturally
  // or can be invalidated when we know specific folder IDs
}

/**
 * Get folders for classification (with caching and preference weights)
 * This is used by the classification service
 */
export async function getUserFoldersForClassification(userId: string): Promise<FolderRow[]> {
  const cacheKey = `user:${userId}:classification`;
  
  // Try cache first (shorter TTL for classification data)
  const cached = await folderCache.get<FolderRow[]>(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Fetch from database with preference weights
  const result = await query(
    `SELECT f.*, up.weights, parent.name as parent_name
     FROM folders f
     LEFT JOIN user_preferences up ON f.id = up.folder_id AND up.user_id = $1
     LEFT JOIN folders parent ON f.parent_id = parent.id
     WHERE f.user_id = $1`,
    [userId]
  );
  
  // Cache with shorter TTL (2 minutes) since preferences can change
  await folderCache.set(cacheKey, result.rows, 120);
  
  return result.rows;
}
