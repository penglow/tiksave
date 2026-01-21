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
import { extractLocationQuery, geocodeLocation } from '../services/location.js';

export const itemsRouter = Router();

// Validation schemas
const createItemSchema = z.object({
  sourceURL: z.string().url(),
  rawSharedText: z.string().optional(),
});

const moveToFolderSchema = z.object({
  folderId: z.string().uuid().nullable(),
});

// Create a new save item
itemsRouter.post('/', async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest;

  try {
    const { sourceURL, rawSharedText } = createItemSchema.parse(req.body);

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

// Get items list
itemsRouter.get('/', async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest;
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
  const authReq = req as unknown as AuthenticatedRequest;
  const { id } = req.params;

  const item = await getItemById(id, authReq.userId);

  if (!item) {
    throw new AppError('Item not found', 404);
  }

  res.json(item);
});

// Get upload URL for video
itemsRouter.post('/:id/uploadUrl', async (req, res: Response) => {
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
itemsRouter.post('/:id/completeUpload', async (req, res: Response) => {
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
itemsRouter.post('/:id/moveFolder', async (req, res: Response) => {
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

// Delete item
itemsRouter.delete('/:id', async (req, res: Response) => {
  const authReq = req as unknown as AuthenticatedRequest;
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

// Process an item immediately (synchronous)
async function processItemNow(
  itemId: string,
  userId: string,
  sourceURL: string,
  rawSharedText?: string
): Promise<void> {
  console.log(`\n🎬 Processing item ${itemId} NOW`);

  // Update status
  await query('UPDATE save_items SET status = $1 WHERE id = $2', ['processing', itemId]);

  // Analyze URL - now includes thumbnail, title, description
  const analysis = await analyzeUrlOnly(sourceURL, rawSharedText);
  console.log('📊 Categories:', analysis.topics);
  console.log('📷 Thumbnail:', analysis.thumbnailUrl ? 'found' : 'not found');

  // Use AI-generated title or fallback
  let title = analysis.title || 'TikTok Video';
  if (!analysis.title && rawSharedText) {
    const withoutHashtags = rawSharedText.replace(/#[\w]+/g, '').trim();
    if (withoutHashtags.length > 5) {
      title = withoutHashtags.slice(0, 100);
    }
  }

  // Location extraction (match worker behavior so new imports can appear on map)
  let locationData: { latitude: number; longitude: number; name: string; address: string } | null = null;
  try {
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

    const locationQuery = await extractLocationQuery(locationText, locationContextText);

    if (locationQuery) {
      locationData = await geocodeLocation(locationQuery);
    }
  } catch (e) {
    // Location extraction is best-effort; failures should not block item creation.
  }

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
      analysis.thumbnailUrl,
      classification.folderId,
      confidenceValue,
      folderId,
      locationData?.latitude || null,
      locationData?.longitude || null,
      locationData?.name || null,
      locationData?.address || null,
      itemId,
    ]
  );

  console.log(`✅ Item ${itemId} processed!`);
  console.log(`   Categories: ${analysis.topics.join(', ')}`);
  console.log(`   Folder: ${classification.folderName || 'none'} (${Math.round(classification.confidence * 100)}% confidence)`);
}


