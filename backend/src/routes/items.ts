import { Router, Response } from 'express';
import { z } from 'zod';
import { query } from '../database/init.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { addToProcessingQueue } from '../workers/videoProcessor.js';
import { generateUploadUrl } from '../services/storage.js';
import { recordTrainingExample, updateUserPreferences } from '../services/learning.js';
import { extractKeywords, extractHashtags } from '../utils/text.js';

export const itemsRouter = Router();

// Validation schemas
const createItemSchema = z.object({
  sourceURL: z.string().url(),
  rawSharedText: z.string().optional(),
});

const moveToFolderSchema = z.object({
  folderId: z.string().uuid(),
});

// Create a new save item
itemsRouter.post('/', async (req, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  
  try {
    const { sourceURL, rawSharedText } = createItemSchema.parse(req.body);
    
    // Check for duplicates (same URL in last 24 hours)
    const duplicate = await query(
      `SELECT id FROM save_items 
       WHERE user_id = $1 AND source_url = $2 
       AND created_at > NOW() - INTERVAL '24 hours'`,
      [authReq.userId, sourceURL]
    );
    
    if (duplicate.rows.length > 0) {
      // Return existing item
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
    
    // Add to processing queue
    await addToProcessingQueue({
      itemId: item.id,
      userId: authReq.userId,
      sourceURL,
      rawSharedText,
    });
    
    res.status(201).json(item);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    throw error;
  }
});

// Get items list
itemsRouter.get('/', async (req, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { status, folderId, limit = '50', offset = '0' } = req.query;
  
  let whereClause = 'WHERE user_id = $1';
  const params: any[] = [authReq.userId];
  let paramIndex = 2;
  
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
  
  params.push(parseInt(limit as string));
  params.push(parseInt(offset as string));
  
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
  
  res.json({
    items: result.rows.map(formatSaveItem),
    total: parseInt(countResult.rows[0].count),
  });
});

// Get single item
itemsRouter.get('/:id', async (req, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { id } = req.params;
  
  const item = await getItemById(id, authReq.userId);
  
  if (!item) {
    throw new AppError('Item not found', 404);
  }
  
  res.json(item);
});

// Get upload URL for video
itemsRouter.post('/:id/uploadUrl', async (req, res: Response) => {
  const authReq = req as AuthenticatedRequest;
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
    `UPDATE save_items SET status = 'upload_requested', updated_at = NOW()
     WHERE id = $1`,
    [id]
  );
  
  res.json({ uploadURL, expiresAt });
});

// Complete upload and start processing
itemsRouter.post('/:id/completeUpload', async (req, res: Response) => {
  const authReq = req as AuthenticatedRequest;
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
itemsRouter.post('/:id/moveFolder', async (req, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { id } = req.params;
  
  try {
    const { folderId } = moveToFolderSchema.parse(req.body);
    
    // Get current item
    const item = await getItemById(id, authReq.userId);
    if (!item) {
      throw new AppError('Item not found', 404);
    }
    
    // Verify folder belongs to user
    const folder = await query(
      'SELECT id, name FROM folders WHERE id = $1 AND user_id = $2',
      [folderId, authReq.userId]
    );
    
    if (folder.rows.length === 0) {
      throw new AppError('Folder not found', 404);
    }
    
    const originalFolderId = item.folderId;
    
    // Update item
    await query(
      `UPDATE save_items 
       SET folder_id = $1, status = 'ready', updated_at = NOW()
       WHERE id = $2`,
      [folderId, id]
    );
    
    // Record training example if this was a correction
    if (originalFolderId !== folderId) {
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

// Delete item
itemsRouter.delete('/:id', async (req, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { id } = req.params;
  
  const result = await query(
    'DELETE FROM save_items WHERE id = $1 AND user_id = $2 RETURNING id',
    [id, authReq.userId]
  );
  
  if (result.rows.length === 0) {
    throw new AppError('Item not found', 404);
  }
  
  res.json({ success: true });
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
    confidence: row.confidence ? parseFloat(row.confidence) : null,
    folderId: row.folder_id,
    folderName: row.folder_name,
    title: row.title,
    duration: row.duration ? parseFloat(row.duration) : null,
    creatorName: row.creator_name,
    creatorUsername: row.creator_username,
    errorMessage: row.error_message,
  };
}


