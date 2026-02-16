import { Router, Response } from 'express';
import { z } from 'zod';
import { query } from '../database/init.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { addToProcessingQueue } from '../workers/videoProcessor.js';
import { generateUploadUrl } from '../services/storage.js';
import { recordTrainingExample, updateUserPreferences } from '../services/learning.js';
import { extractKeywords, extractHashtags } from '../utils/text.js';
import { analyzeUrlOnly } from '../services/videoIndexer.js';
import { classifyItem } from '../services/classification.js';
import { extractLocationQueries, geocodeLocation } from '../services/location.js';
import { withLock } from '../services/redis.js';
import { sanitizeTikTokUrl, sanitizeTikTokImageUrl, sanitizeUserContent, sanitizeString } from '../utils/sanitize.js';
import { validateParams, CommonSchemas } from '../middleware/validation.js';
import {
  parseCursorPagination,
  decodeCursor,
  encodeCursor,
  processPaginatedResults,
  type CursorPaginationResult,
} from '../utils/pagination.js';
import { 
  getStageConfig, 
  getStageDisplayInfo,
  type ProcessingStage 
} from '../services/processingStages.js';

export const itemsRouter = Router();

// Validation schemas
const createItemSchema = z.object({
  sourceURL: z.string().url(),
  rawSharedText: z.string().optional(),
});

const batchCreateSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(50), // Max 50 URLs per batch
  options: z.object({
    skipDuplicates: z.boolean().default(true),
    autoOrganize: z.boolean().default(true),
  }).optional(),
});

const moveToFolderSchema = z.object({
  folderId: z.string().uuid().nullable(),
});

// Create a new save item
itemsRouter.post('/', async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest;

  try {
    const parsed = createItemSchema.parse(req.body);
    
    // Sanitize user input
    const sourceURL = sanitizeTikTokUrl(parsed.sourceURL);
    if (!sourceURL) {
      return res.status(400).json({ error: 'Invalid TikTok URL' });
    }
    
    const rawSharedText = parsed.rawSharedText 
      ? sanitizeUserContent(parsed.rawSharedText, 5000) 
      : undefined;

    // Check for exact duplicate URL (same URL in last 5 minutes only)
    const duplicate = await query(
      `SELECT id FROM save_items 
       WHERE user_id = $1 AND source_url = $2 
       AND created_at > NOW() - INTERVAL '5 minutes'`,
      [authReq.userId, sourceURL]
    );

    if (duplicate.rows.length > 0) {
      // Return existing item if just added
      const existing = await getItemById(duplicate.rows[0].id);
      return res.json(existing);
    }

    // Create new item
    const result = await query(
      `INSERT INTO save_items (
        user_id, source_url, raw_shared_text, status, detected_topics, detected_labels
      ) VALUES ($1, $2, $3, 'queued', '{}', '{}')
      RETURNING *`,
      [authReq.userId, sourceURL, rawSharedText]
    );

    const item = formatSaveItem(result.rows[0]);

    // Process immediately for faster feedback (dev mode)
    // In production, use the queue for scalability
    try {
      console.log('🚀 Processing item immediately:', item.id);
      await processItemNow(item.id, authReq.userId, sourceURL, rawSharedText);

      // Return updated item
      const updated = await getItemById(item.id, authReq.userId);
      return res.status(201).json(updated);
    } catch (processingError) {
      console.error('⚠️ Immediate processing failed, queuing:', processingError);
      // Fallback to queue
      await addToProcessingQueue({
        itemId: item.id,
        userId: authReq.userId,
        sourceURL,
        rawSharedText,
      });
    }

    res.status(201).json(item);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    throw error;
  }
});

// Batch create items (multiple URLs at once)
itemsRouter.post('/batch', async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest;

  try {
    const parsed = batchCreateSchema.parse(req.body);
    const { skipDuplicates = true, autoOrganize = true } = parsed.options || {};

    const results = {
      total: parsed.urls.length,
      queued: 0,
      duplicates: 0,
      errors: 0,
      items: [] as Array<{
        id: string;
        url: string;
        status: 'queued' | 'duplicate' | 'error';
        error?: string;
      }>,
    };

    // Process URLs in parallel (with concurrency limit)
    const concurrencyLimit = 5;
    const batches = [];
    
    for (let i = 0; i < parsed.urls.length; i += concurrencyLimit) {
      batches.push(parsed.urls.slice(i, i + concurrencyLimit));
    }

    for (const batch of batches) {
      const batchPromises = batch.map(async (url) => {
        try {
          // Sanitize URL
          const sourceURL = sanitizeTikTokUrl(url);
          if (!sourceURL) {
            results.errors++;
            return {
              id: '',
              url,
              status: 'error' as const,
              error: 'Invalid TikTok URL',
            };
          }

          // Check for duplicates (if enabled)
          if (skipDuplicates) {
            const duplicate = await query(
              `SELECT id FROM save_items 
               WHERE user_id = $1 AND source_url = $2 
               AND deleted_at IS NULL`,
              [authReq.userId, sourceURL]
            );

            if (duplicate.rows.length > 0) {
              results.duplicates++;
              return {
                id: duplicate.rows[0].id,
                url: sourceURL,
                status: 'duplicate' as const,
              };
            }
          }

          // Create new item
          const result = await query(
            `INSERT INTO save_items (
              user_id, source_url, status, detected_topics, detected_labels,
              processing_stage, processing_progress, processing_message
            ) VALUES ($1, $2, 'queued', '{}', '{}', 'queued', 5, 'In queue...')
            RETURNING id`,
            [authReq.userId, sourceURL]
          );

          const itemId = result.rows[0].id;
          results.queued++;

          // Queue for processing (don't wait)
          addToProcessingQueue({
            itemId,
            userId: authReq.userId,
            sourceURL,
          }).catch(err => {
            console.error(`Failed to queue item ${itemId}:`, err);
          });

          return {
            id: itemId,
            url: sourceURL,
            status: 'queued' as const,
          };
        } catch (error) {
          results.errors++;
          return {
            id: '',
            url,
            status: 'error' as const,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.items.push(...batchResults);
    }

    res.status(202).json({
      batchId: `${Date.now()}-${authReq.userId}`,
      ...results,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid batch request',
        details: error.errors 
      });
    }
    throw error;
  }
});

// Helper to safely parse pagination params
function parsePaginationParams(limitStr: string, offsetStr: string, maxLimit = 100): { limit: number; offset: number } {
  const parsedLimit = parseInt(limitStr, 10);
  const parsedOffset = parseInt(offsetStr, 10);
  
  return {
    limit: Math.max(1, Math.min(maxLimit, isNaN(parsedLimit) ? 50 : parsedLimit)),
    offset: Math.max(0, isNaN(parsedOffset) ? 0 : parsedOffset),
  };
}

// Get items list (excludes soft-deleted items by default)
itemsRouter.get('/', async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest;
  const { status, folderId, limit = '50', offset = '0', includeDeleted } = req.query;

  try {
    let whereClause = 'WHERE user_id = $1';
    const params: any[] = [authReq.userId];
    let paramIndex = 2;
    
    // Exclude soft-deleted items unless explicitly requested
    if (includeDeleted !== 'true') {
      whereClause += ' AND deleted_at IS NULL';
    }

    if (status) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (folderId) {
      whereClause += ` AND folder_id = $${paramIndex}`;
      params.push(folderId);
      paramIndex++;
    }

    const { limit: parsedLimit, offset: parsedOffset } = parsePaginationParams(
      limit as string,
      offset as string
    );
    params.push(parsedLimit);
    params.push(parsedOffset);

    const result = await query(
      `SELECT * FROM save_items 
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    const countResult = await query(
      `SELECT COUNT(*) FROM save_items ${whereClause}`,
      params.slice(0, -2)
    );

    const total = parseInt(countResult.rows[0].count, 10);

    // Add pagination headers
    res.setHeader('X-Total-Count', total);
    res.setHeader('X-Limit', parsedLimit);
    res.setHeader('X-Offset', parsedOffset);

    res.json({
      items: result.rows.map(formatSaveItem),
      total,
    });
  } catch (error) {
    console.error('Error fetching items:', error);
    throw error;
  }
});

// Get items with cursor-based pagination (more efficient for large datasets)
// Query params: cursor (base64), limit (default 20, max 100), direction (next|prev)
itemsRouter.get('/paginated', async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest;
  const { status, folderId, includeDeleted } = req.query;

  try {
    // Parse pagination parameters
    const { cursor, limit, direction } = parseCursorPagination(req.query, 20, 100);
    
    // Decode cursor if provided
    const cursorData = cursor ? decodeCursor(cursor) : null;
    if (cursor && !cursorData) {
      return res.status(400).json({ error: 'Invalid cursor format' });
    }

    // Build base WHERE clause (use si. prefix to avoid ambiguity with joined tables)
    let baseWhere = 'si.user_id = $1';
    const baseParams: (string | number | boolean)[] = [authReq.userId];
    let paramIndex = 2;
    
    // Exclude soft-deleted items unless explicitly requested
    if (includeDeleted !== 'true') {
      baseWhere += ` AND si.deleted_at IS NULL`;
    }

    if (status) {
      baseWhere += ` AND si.status = $${paramIndex}`;
      baseParams.push(String(status));
      paramIndex++;
    }

    if (folderId) {
      baseWhere += ` AND si.folder_id = $${paramIndex}`;
      baseParams.push(String(folderId));
      paramIndex++;
    }

    // Add cursor condition for efficient pagination
    if (cursorData) {
      const operator = direction === 'next' ? '<' : '>';
      baseWhere += ` AND (si.created_at, si.id) ${operator} ($${paramIndex}, $${paramIndex + 1})`;
      baseParams.push(cursorData.createdAt, cursorData.id);
      paramIndex += 2;
    }

    // Determine sort order (use si. prefix for clarity)
    const orderBy = direction === 'next' 
      ? 'ORDER BY si.created_at DESC, si.id DESC'
      : 'ORDER BY si.created_at ASC, si.id ASC';

    // Fetch one extra item to determine if there's more data
    const result = await query(
      `SELECT si.*, f.name as folder_name 
       FROM save_items si
       LEFT JOIN folders f ON si.folder_id = f.id
       WHERE ${baseWhere}
       ${orderBy}
       LIMIT $${paramIndex}`,
      [...baseParams, limit + 1]
    );

    // Process results
    const items = result.rows.map(formatSaveItem);
    const hasMore = items.length > limit;
    const actualItems = hasMore ? items.slice(0, limit) : items;
    
    // Reverse items if paginating backwards to maintain consistent order
    const finalItems = direction === 'prev' ? [...actualItems].reverse() : actualItems;

    // Generate cursors
    let nextCursor: string | null = null;
    let prevCursor: string | null = null;

    if (finalItems.length > 0) {
      // Next cursor from last item
      if (hasMore || direction === 'prev') {
        const lastItem = finalItems[finalItems.length - 1];
        nextCursor = encodeCursor(lastItem.dateAdded, lastItem.id);
      }
      
      // Prev cursor from first item
      if (direction === 'next' && (cursor || finalItems.length > 0)) {
        const firstItem = finalItems[0];
        prevCursor = encodeCursor(firstItem.dateAdded, firstItem.id);
      }
    }

    // Add pagination headers
    res.setHeader('X-Limit', limit);
    res.setHeader('X-Direction', direction);
    if (nextCursor) res.setHeader('X-Next-Cursor', nextCursor);
    if (prevCursor) res.setHeader('X-Prev-Cursor', prevCursor);

    res.json({
      items: finalItems,
      pagination: {
        nextCursor,
        prevCursor,
        hasMore,
      },
    });
  } catch (error) {
    console.error('Error fetching paginated items:', error);
    throw error;
  }
});

// Get processing status for an item (for real-time progress updates)
itemsRouter.get('/:id/progress', validateParams(CommonSchemas.idParam), async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest;
  const { id } = req.params;

  const item = await getItemById(id, authReq.userId);

  if (!item) {
    throw new AppError('Item not found', 404);
  }

  // Return processing status with display info
  const stageInfo = getStageDisplayInfo(item.status === 'ready' ? 'ready' : 
    item.status === 'error' ? 'error' : 
    (item as any).processing_stage || 'queued');

  res.json({
    id: item.id,
    status: item.status,
    processing: {
      stage: stageInfo.stage,
      progress: (item as any).processing_progress || stageInfo.progress,
      message: (item as any).processing_message || stageInfo.message,
      emoji: stageInfo.emoji,
    },
  });
});

// Get map markers (one row per location)
itemsRouter.get('/map', async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest;
  const { limit = '500', offset = '0' } = req.query;

  try {
    const { limit: parsedLimit, offset: parsedOffset } = parsePaginationParams(
      limit as string,
      offset as string,
      2000 // Higher max for map data
    );

    // Use a CTE to ensure we don't get duplicates when both new locations table
    // and legacy columns have data for the same item
    const result = await query(
      `WITH location_data AS (
        -- Primary source: save_item_locations table (supports multiple locations per item)
        SELECT
          si.*,
          sil.id as location_id,
          sil.latitude as sil_latitude,
          sil.longitude as sil_longitude,
          sil.location_name as sil_location_name,
          sil.address as sil_address,
          f.name as folder_name,
          1 as source_priority
        FROM save_item_locations sil
        JOIN save_items si ON si.id = sil.item_id
        LEFT JOIN folders f ON si.folder_id = f.id
        WHERE si.user_id = $1
          AND si.deleted_at IS NULL
        
        UNION ALL
        
        -- Fallback: legacy single-location columns (only if no entries in save_item_locations)
        SELECT
          si.*,
          NULL::uuid as location_id,
          si.latitude as sil_latitude,
          si.longitude as sil_longitude,
          si.location_name as sil_location_name,
          si.address as sil_address,
          f.name as folder_name,
          2 as source_priority
        FROM save_items si
        LEFT JOIN folders f ON si.folder_id = f.id
        WHERE si.user_id = $1
          AND si.deleted_at IS NULL
          AND si.latitude IS NOT NULL
          AND si.longitude IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM save_item_locations sil2 WHERE sil2.item_id = si.id
          )
      )
      SELECT * FROM location_data
      ORDER BY created_at DESC, source_priority ASC
      LIMIT $2 OFFSET $3`,
      [authReq.userId, parsedLimit, parsedOffset]
    );

    const countResult = await query(
      `WITH location_data AS (
        SELECT
          si.id,
          1 as source_priority
        FROM save_item_locations sil
        JOIN save_items si ON si.id = sil.item_id
        WHERE si.user_id = $1
          AND si.deleted_at IS NULL

        UNION ALL

        SELECT
          si.id,
          2 as source_priority
        FROM save_items si
        WHERE si.user_id = $1
          AND si.deleted_at IS NULL
          AND si.latitude IS NOT NULL
          AND si.longitude IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM save_item_locations sil2 WHERE sil2.item_id = si.id
          )
      )
      SELECT COUNT(*) as count FROM location_data`,
      [authReq.userId]
    );

    // Add pagination headers for consistency with /items endpoint
    res.setHeader('X-Total-Count', countResult.rows[0]?.count || 0);
    res.setHeader('X-Limit', parsedLimit);
    res.setHeader('X-Offset', parsedOffset);

    res.json({
      items: result.rows.map((row: any) => ({
        ...formatSaveItem(row),
        locationId: row.location_id,
        latitude: row.sil_latitude ? parseFloat(row.sil_latitude) : null,
        longitude: row.sil_longitude ? parseFloat(row.sil_longitude) : null,
        locationName: row.sil_location_name,
        address: row.sil_address,
      })),
      total: parseInt(countResult.rows[0]?.count || '0', 10),
    });
  } catch (error) {
    console.error('Error fetching map items:', error);
    throw error;
  }
});

// Get single item
itemsRouter.get('/:id', validateParams(CommonSchemas.idParam), async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest;
  const { id } = req.params;

  const item = await getItemById(id, authReq.userId);

  if (!item) {
    throw new AppError('Item not found', 404);
  }

  res.json(item);
});

// Get upload URL for video
itemsRouter.post('/:id/uploadUrl', validateParams(CommonSchemas.idParam), async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest;
  const { id } = req.params;

  // Verify item belongs to user
  const item = await getItemById(id, authReq.userId);
  if (!item) {
    throw new AppError('Item not found', 404);
  }

  // Generate signed upload URL
  const { uploadURL, blobName, expiresAt } = await generateUploadUrl(id);

  // Update item status
  await query(
    `UPDATE save_items 
     SET status = 'upload_requested', video_blob_name = $2, updated_at = NOW()
     WHERE id = $1`,
    [id, blobName]
  );

  // Return blobName too (helpful for debugging/clients), but server also persists it.
  res.json({ uploadURL, expiresAt, blobName });
});

// Complete upload and start processing
itemsRouter.post('/:id/completeUpload', validateParams(CommonSchemas.idParam), async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest;
  const { id } = req.params;

  const item = await getItemById(id, authReq.userId);
  if (!item) {
    throw new AppError('Item not found', 404);
  }

  // Update status and re-queue for video processing
  await query(
    `UPDATE save_items SET status = 'uploading', updated_at = NOW()
     WHERE id = $1`,
    [id]
  );

  await addToProcessingQueue({
    itemId: id,
    userId: authReq.userId,
    sourceURL: item.sourceURL,
    hasUploadedVideo: true,
  });

  const updated = await getItemById(id, authReq.userId);
  res.json(updated);
});

// Move item to folder (user correction)
itemsRouter.post('/:id/moveFolder', validateParams(CommonSchemas.idParam), async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest;
  const { id } = req.params;

  try {
    const { folderId } = moveToFolderSchema.parse(req.body);

    // Get current item
    const item = await getItemById(id, authReq.userId);
    if (!item) {
      throw new AppError('Item not found', 404);
    }

    // If folderId is provided, verify folder belongs to user
    if (folderId !== null) {
      const folder = await query(
        'SELECT id, name FROM folders WHERE id = $1 AND user_id = $2',
        [folderId, authReq.userId]
      );

      if (folder.rows.length === 0) {
        throw new AppError('Folder not found', 404);
      }
    }

    const originalFolderId = item.folderId;

    // Update item (folderId can be null to move back to library)
    await query(
      `UPDATE save_items 
       SET folder_id = $1, status = 'ready', updated_at = NOW()
       WHERE id = $2`,
      [folderId, id]
    );

    // Record training example if this was a correction (only if moving to a folder, not to library)
    if (originalFolderId !== folderId && folderId !== null) {
      await recordTrainingExample({
        userId: authReq.userId,
        itemId: id,
        originalFolderId,
        correctedFolderId: folderId,
        features: {
          topics: item.detectedTopics || [],
          labels: item.detectedLabels || [],
          transcriptKeywords: extractKeywords(item.transcriptText),
          hashtags: extractHashtags(item.rawSharedText),
          creatorUsername: item.creatorUsername,
        },
      });

      // Update user preferences
      await updateUserPreferences(authReq.userId, folderId, {
        topics: item.detectedTopics || [],
        labels: item.detectedLabels || [],
        creator: item.creatorUsername,
      }, originalFolderId);
    }

    const updated = await getItemById(id, authReq.userId);
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    throw error;
  }
});

// Soft delete item
itemsRouter.delete('/:id', validateParams(CommonSchemas.idParam), async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest;
  const { id } = req.params;
  const { permanent } = req.query; // ?permanent=true for hard delete

  if (permanent === 'true') {
    // Hard delete - permanent removal
    const result = await query(
      'DELETE FROM save_items WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, authReq.userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Item not found', 404);
    }
  } else {
    // Soft delete - mark as deleted
    const result = await query(
      `UPDATE save_items 
       SET deleted_at = NOW(), updated_at = NOW() 
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [id, authReq.userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Item not found', 404);
    }
  }

  res.json({ success: true });
});

// Restore soft-deleted item
itemsRouter.post('/:id/restore', validateParams(CommonSchemas.idParam), async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest;
  const { id } = req.params;

  const result = await query(
    `UPDATE save_items 
     SET deleted_at = NULL, updated_at = NOW() 
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL
     RETURNING *`,
    [id, authReq.userId]
  );

  if (result.rows.length === 0) {
    throw new AppError('Item not found or not deleted', 404);
  }

  res.json(formatSaveItem(result.rows[0]));
});

// Get deleted items (trash)
itemsRouter.get('/trash/list', async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest;
  const { limit = '50', offset = '0' } = req.query;

  const { limit: parsedLimit, offset: parsedOffset } = parsePaginationParams(
    limit as string,
    offset as string
  );

  const result = await query(
    `SELECT * FROM save_items 
     WHERE user_id = $1 AND deleted_at IS NOT NULL
     ORDER BY deleted_at DESC
     LIMIT $2 OFFSET $3`,
    [authReq.userId, parsedLimit, parsedOffset]
  );

  const countResult = await query(
    `SELECT COUNT(*) FROM save_items WHERE user_id = $1 AND deleted_at IS NOT NULL`,
    [authReq.userId]
  );

  res.setHeader('X-Total-Count', countResult.rows[0].count);
  res.json({
    items: result.rows.map(formatSaveItem),
    total: parseInt(countResult.rows[0].count, 10),
  });
});

// Helper functions
async function getItemById(id: string, userId?: string) {
  let queryStr = `
    SELECT si.*, f.name as folder_name 
    FROM save_items si
    LEFT JOIN folders f ON si.folder_id = f.id
    WHERE si.id = $1
  `;
  const params: any[] = [id];

  if (userId) {
    queryStr += ' AND si.user_id = $2';
    params.push(userId);
  }

  const result = await query(queryStr, params);

  if (result.rows.length === 0) {
    return null;
  }

  return formatSaveItem(result.rows[0]);
}

function formatSaveItem(row: any) {
  return {
    id: row.id,
    sourceURL: row.source_url,
    dateAdded: row.created_at,
    rawSharedText: row.raw_shared_text,
    status: row.status,
    thumbnailURL: row.thumbnail_url,
    transcriptText: row.transcript_text,
    detectedTopics: row.detected_topics || [],
    detectedLabels: row.detected_labels || [],
    predictedFolderId: row.predicted_folder_id,
    confidence: row.confidence != null ? parseFloat(row.confidence) : undefined,
    folderId: row.folder_id,
    folderName: row.folder_name,
    title: row.title,
    duration: row.duration ? parseFloat(row.duration) : null,
    creatorName: row.creator_name,
    creatorUsername: row.creator_username,
    errorMessage: row.error_message,
    latitude: row.latitude ? parseFloat(row.latitude) : null,
    longitude: row.longitude ? parseFloat(row.longitude) : null,
    locationName: row.location_name,
    address: row.address,
  };
}

// Process an item immediately (synchronous) with distributed locking
async function processItemNow(
  itemId: string,
  userId: string,
  sourceURL: string,
  rawSharedText?: string
): Promise<void> {
  // Use distributed lock to prevent concurrent processing across multiple server instances
  const result = await withLock(
    `processing:${itemId}`,
    async () => {
      console.log(`\n🎬 Processing item ${itemId} NOW`);

      // Update status with optimistic lock check
      const lockResult = await query(
        `UPDATE save_items 
         SET status = 'processing', updated_at = NOW() 
         WHERE id = $1 AND status NOT IN ('processing', 'ready')
         RETURNING id`,
        [itemId]
      );
      
      if (lockResult.rows.length === 0) {
        console.log(`⏳ Item ${itemId} is already processed or being processed`);
        return 'skipped';
      }
      
      await doProcessItem(itemId, userId, sourceURL, rawSharedText);
      return 'processed';
    },
    { ttlMs: 120000 } // 2 minute lock timeout for processing
  );
  
  if (result === null) {
    console.log(`⏳ Item ${itemId} is already being processed by another worker, skipping`);
  }
}

// Internal processing logic (called while holding the lock)
async function doProcessItem(
  itemId: string,
  userId: string,
  sourceURL: string,
  rawSharedText?: string
): Promise<void> {
  try {
    // Stage 1: Downloading
    await updateProcessingStage(itemId, 'downloading');
    console.log(`⬇️  [${itemId}] Downloading video info...`);

    // Analyze URL - now includes thumbnail, title, description
    const analysis = await analyzeUrlOnly(sourceURL, rawSharedText);
    console.log('📊 Categories:', analysis.topics);
    console.log('📷 Thumbnail:', analysis.thumbnailUrl ? 'found' : 'not found');

  // Stage 2: Analyzing
  await updateProcessingStage(itemId, 'analyzing');
  console.log(`🤖 [${itemId}] Analyzing content with AI...`);

  // Use AI-generated title or fallback, sanitize to prevent XSS
  let title = sanitizeString(analysis.title, { maxLength: 500, allowNewlines: false }) || 'TikTok Video';
  if (!analysis.title && rawSharedText) {
    const withoutHashtags = rawSharedText.replace(/#[\w]+/g, '').trim();
    if (withoutHashtags.length > 5) {
      title = sanitizeString(withoutHashtags, { maxLength: 100, allowNewlines: false });
    }
  }

  // Location extraction (match worker behavior so new imports can appear on map)
  let locationData: { latitude: number; longitude: number; name: string; address: string }[] = [];
  try {
    // Stage 3: Extracting location
    await updateProcessingStage(itemId, 'extracting_location');
    console.log(`📍 [${itemId}] Extracting location data...`);
    
    const description = analysis.description || '';
    const locationText = [
      rawSharedText,
      title ? `Title: ${title}` : '',
      description ? `Description: ${description}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const locationContextText = [
      (analysis.topics || []).length > 0 ? `Topics: ${analysis.topics.join(', ')}` : '',
      (analysis.labels || []).length > 0 ? `Labels: ${analysis.labels.join(', ')}` : '',
      analysis.creator ? `Creator: @${analysis.creator}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const locationQueries = await extractLocationQueries(locationText, locationContextText);

    if (locationQueries.length > 0) {
      for (const q of locationQueries) {
        const geo = await geocodeLocation(q);
        if (geo) locationData.push(geo);
        await new Promise((r) => setTimeout(r, 150));
      }

      const seenCoords = new Set<string>();
      locationData = locationData.filter((l) => {
        const key = `${l.latitude},${l.longitude}`;
        if (seenCoords.has(key)) return false;
        seenCoords.add(key);
        return true;
      });
    }
  } catch (e) {
    // Location extraction is best-effort; failures should not block item creation.
  }

  // Persist multiple locations (and keep first as legacy columns for compatibility)
  try {
    await query(`DELETE FROM save_item_locations WHERE item_id = $1`, [itemId]);
    for (const loc of locationData) {
      await query(
        `INSERT INTO save_item_locations (item_id, latitude, longitude, location_name, address)
         VALUES ($1, $2, $3, $4, $5)`,
        [itemId, loc.latitude, loc.longitude, loc.name || null, loc.address || null]
      );
    }
  } catch (e) {
    // Best-effort
  }

  // Stage 4: Classifying
  await updateProcessingStage(itemId, 'classifying');
  console.log(`📁 [${itemId}] Classifying into folder...`);

  // Classify into folder
  const classification = await classifyItem(userId, {
    topics: analysis.topics || [],
    labels: analysis.labels || [],
    transcriptText: undefined,
    hashtags: extractHashtags(rawSharedText),
    creatorUsername: analysis.creator,
  });

  // Determine final status based on confidence
  // Assign folder if classification found one (confidence >= 0.3 threshold in classification service)
  const folderId = classification.folderId || null;

  // If a folder was assigned, mark as ready so it appears in library
  // The classification service already ensures confidence >= 0.3 before returning a folderId
  const status = folderId ? 'ready' : 'needs_review';

  // Only store confidence if it's meaningful (>= 0.1), otherwise store NULL
  const confidenceValue = classification.confidence >= 0.1 ? classification.confidence : null;

  // Stage 5: Saving
  await updateProcessingStage(itemId, 'saving');
  console.log(`💾 [${itemId}] Saving results...`);

  // Update item with results including classification and confidence
  await query(
    `UPDATE save_items SET
      status = $1,
      detected_topics = $2,
      detected_labels = $3,
      creator_username = $4,
      title = $5,
      thumbnail_url = $6,
      predicted_folder_id = $7,
      confidence = $8,
      folder_id = $9,
      latitude = $10,
      longitude = $11,
      location_name = $12,
      address = $13,
      updated_at = NOW()
     WHERE id = $14`,
    [
      status,
      analysis.topics,
      analysis.labels,
      analysis.creator,
      title,
      sanitizeTikTokImageUrl(analysis.thumbnailUrl),
      classification.folderId,
      confidenceValue,
      folderId,
      locationData[0]?.latitude || null,
      locationData[0]?.longitude || null,
      locationData[0]?.name || null,
      locationData[0]?.address || null,
      itemId,
    ]
  );

  // Stage 6: Ready
  await updateProcessingStage(itemId, 'ready');
  
  console.log(`✅ Item ${itemId} processed!`);
  console.log(`   Categories: ${analysis.topics.join(', ')}`);
  console.log(`   Folder: ${classification.folderName || 'none'} (${Math.round(classification.confidence * 100)}% confidence)`);
  
  } catch (error) {
    // Update to error state
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during processing';
    console.error(`❌ [${itemId}] Processing failed:`, errorMessage);
    await updateProcessingStage(itemId, 'error', errorMessage);
    throw error;
  }
}

// Helper function to update processing stage
async function updateProcessingStage(
  itemId: string, 
  stage: ProcessingStage,
  errorMessage?: string
): Promise<void> {
  const config = getStageConfig(stage);
  
  await query(
    `UPDATE save_items SET
      processing_stage = $1,
      processing_progress = $2,
      processing_message = $3,
      error_message = COALESCE($4, error_message),
      updated_at = NOW()
     WHERE id = $5`,
    [stage, config.progress, config.message, errorMessage || null, itemId]
  );
}
