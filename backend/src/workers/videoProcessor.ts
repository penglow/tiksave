import Queue from 'bull';
import { query } from '../database/init.js';
import { indexVideo, getVideoIndex, analyzeUrlOnly, getThumbnailUrl, generateSemanticContext } from '../services/videoIndexer.js';
import { classifyItem } from '../services/classification.js';
import { generateItemEmbedding } from '../services/embeddings.js';
import { getBlobUrl, listBlobs } from '../services/storage.js';
import { extractHashtags } from '../utils/text.js';
import { extractLocationQueries, geocodeLocation } from '../services/location.js';

// Redis connection for job queue
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Job queue
const processingQueue = new Queue('video-processing', REDIS_URL, {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

interface ProcessingJob {
  itemId: string;
  userId: string;
  sourceURL: string;
  rawSharedText?: string;
  hasUploadedVideo?: boolean;
}

/**
 * Add an item to the processing queue
 */
export async function addToProcessingQueue(job: ProcessingJob): Promise<void> {
  await processingQueue.add('process', job, {
    priority: job.hasUploadedVideo ? 1 : 2, // Uploaded videos get priority
  });
}

/**
 * Start the background worker
 */
export function startWorker(): void {
  processingQueue.process('process', 5, async (job) => {
    const { itemId, userId, sourceURL, rawSharedText, hasUploadedVideo } = job.data as ProcessingJob;

    console.log(`\n🎬 Processing item ${itemId}`);
    console.log(`   URL: ${sourceURL}`);
    console.log(`   Shared text: ${rawSharedText?.substring(0, 100) || '(none)'}`);

    try {
      // Update status to processing
      await updateItemStatus(itemId, 'processing');
      console.log('   Status: processing');

      let insights: any = null;
      let videoIndexerId: string | null = null;
      let thumbnailUrl: string | null = null;

      // Mode B: Full video analysis (if video was uploaded and Azure is configured)
      if (hasUploadedVideo && process.env.AZURE_VIDEO_INDEXER_ACCOUNT_ID) {
        try {
          console.log('   Using Azure Video Indexer...');
          insights = await processWithVideoIndexer(itemId, userId);
          videoIndexerId = insights?.videoIndexerId;
          thumbnailUrl = insights?.thumbnailUrl;
        } catch (error) {
          console.error('   Video indexer failed, falling back to URL analysis:', error);
        }
      }

      // Mode A: URL-only analysis (fast, no external API calls)
      if (!insights) {
        console.log('   Using fast URL analysis...');
        insights = await analyzeUrlOnly(sourceURL, rawSharedText);
        console.log('   Analysis complete:', JSON.stringify(insights));
      }

      // Extract thumbnail from insights (for URL-only analysis)
      if (!thumbnailUrl && insights?.thumbnailUrl) {
        thumbnailUrl = insights.thumbnailUrl;
        console.log('   📷 Thumbnail from URL analysis:', thumbnailUrl);
      }

      // Extract data from insights
      const { topics, labels, transcript, creator, duration } = normalizeInsights(insights, rawSharedText);

      // Generate rich semantic context for better search understanding
      console.log('   🔍 Generating semantic context...');
      const semanticData = await generateSemanticContext({
        title: insights.title || insights.description,
        transcript: transcript || undefined,
        topics: topics.length > 0 ? topics : undefined,
        labels: labels.length > 0 ? labels : undefined,
        keywords: insights.keywords || undefined,
        rawSharedText: rawSharedText || undefined,
        description: insights.description,
      });

      if (semanticData.semanticContext) {
        console.log(`   📄 Semantic context: ${semanticData.semanticContext.substring(0, 150)}...`);
      }

      // Store semantic context in insights_json
      const enhancedInsights = {
        ...insights,
        semanticContext: semanticData.semanticContext,
      };

      // Classify into folder
      const classification = await classifyItem(userId, {
        topics,
        labels,
        transcriptText: transcript || undefined,
        hashtags: extractHashtags(rawSharedText),
        creatorUsername: creator || undefined,
      });

      // Generate embedding for semantic search (uses rich semantic context)
      const embedding = await generateItemEmbedding({
        transcriptText: transcript || undefined,
        detectedTopics: topics,
        detectedLabels: labels,
        rawSharedText: rawSharedText || undefined,
        semanticContext: semanticData.semanticContext,
      });

      // Determine final status
      // Assign folder if classification found one (confidence >= 0.3 threshold in classification service)
      const folderId = classification.folderId || null;

      // If a folder was assigned, mark as ready so it appears in library
      // The classification service already ensures confidence >= 0.3 before returning a folderId
      const status = folderId ? 'ready' : 'needs_review';

      // Generate title from transcript or shared text
      const title = generateTitle(transcript, rawSharedText || null);

      // Only store confidence if it's meaningful (>= 0.1), otherwise store NULL
      const confidenceValue = classification.confidence >= 0.1 ? classification.confidence : null;


      // Location Extraction Phase (supports multiple locations)
      let locationData: { latitude: number; longitude: number; name: string; address: string }[] = [];

      console.log('   EARTH: Checking for location in content...');
      // Combine richer signals for location search (shared text + description + transcript + OCR + keywords + semantic context)
      const description = typeof insights?.description === 'string' ? insights.description : '';
      const semanticContext = semanticData.semanticContext || '';

      const keywordTexts: string[] = Array.isArray(insights?.keywords)
        ? insights.keywords
            .map((k: any) => (typeof k === 'string' ? k : k?.text || k?.name || ''))
            .filter(Boolean)
            .slice(0, 25)
        : [];

      const ocrTexts: string[] = Array.isArray(insights?.ocr)
        ? Array.from(
            new Set<string>(
              insights.ocr
                .map((o: any) => (typeof o === 'string' ? o : o?.text || ''))
                .map((s: string) => s.trim())
                .filter(Boolean)
            )
          ).slice(0, 40)
        : [];

      const transcriptForLocation = transcript ? transcript.slice(0, 2500) : '';

      const locationText = [
        rawSharedText,
        title ? `Title: ${title}` : '',
        description ? `Description: ${description}` : '',
        ocrTexts.length > 0 ? `On-screen text (OCR): ${ocrTexts.join(' | ')}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const locationContextText = [
        transcriptForLocation ? `Transcript: ${transcriptForLocation}` : '',
        topics.length > 0 ? `Topics: ${topics.join(', ')}` : '',
        labels.length > 0 ? `Labels: ${labels.join(', ')}` : '',
        keywordTexts.length > 0 ? `Keywords: ${keywordTexts.join(', ')}` : '',
        semanticContext ? `Semantic context: ${semanticContext}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      const locationQueries = await extractLocationQueries(locationText, locationContextText);

      if (locationQueries.length > 0) {
        console.log(`   📍 Found ${locationQueries.length} location candidate(s)`);

        for (const q of locationQueries) {
          const geo = await geocodeLocation(q);
          if (geo) {
            locationData.push(geo);
            console.log(`   ✅ Geocoded: ${geo.name} (${geo.latitude}, ${geo.longitude})`);
          } else {
            console.log(`   ⚠️ Could not geocode: "${q}"`);
          }
          // Small delay to be nice to Google API
          await new Promise((r) => setTimeout(r, 150));
        }

        // De-duplicate near-identical coordinates (string compare is fine for our precision)
        const seenCoords = new Set<string>();
        locationData = locationData.filter((l) => {
          const key = `${l.latitude},${l.longitude}`;
          if (seenCoords.has(key)) return false;
          seenCoords.add(key);
          return true;
        });
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
        // Best-effort; do not block processing
      }

      // Update item with all results
      await query(
        `UPDATE save_items SET
          status = $1,
          thumbnail_url = $2,
          transcript_text = $3,
          detected_topics = $4,
          detected_labels = $5,
          predicted_folder_id = $6,
          confidence = $7,
          folder_id = $8,
          title = $9,
          duration = $10,
          creator_username = $11,
          video_indexer_id = $12,
          insights_json = $13,
          embedding = $14,
          latitude = $15,
          longitude = $16,
          location_name = $17,
          address = $18,
          updated_at = NOW()
         WHERE id = $19`,
        [
          status,
          thumbnailUrl,
          transcript,
          topics,
          labels,
          classification.folderId,
          confidenceValue,
          folderId,
          title,
          duration,
          creator,
          videoIndexerId,
          JSON.stringify(enhancedInsights),
          embedding ? `[${embedding.join(',')}]` : null,
          locationData[0]?.latitude || null,
          locationData[0]?.longitude || null,
          locationData[0]?.name || null,
          locationData[0]?.address || null,
          itemId,
        ]
      );

      console.log(`\n✅ Item ${itemId} processed successfully`);
      console.log(`   Status: ${status}`);
      console.log(`   Topics: ${topics.join(', ') || 'none'}`);
      console.log(`   Labels: ${labels.join(', ') || 'none'}`);
      console.log(`   Folder: ${classification.folderName || 'none'} (${Math.round(classification.confidence * 100)}% confidence)`);

    } catch (error) {
      console.error(`Failed to process item ${itemId}:`, error);

      await query(
        `UPDATE save_items SET
          status = 'failed',
          error_message = $1,
          updated_at = NOW()
         WHERE id = $2`,
        [(error as Error).message, itemId]
      );

      throw error;
    }
  });

  // Error handling
  processingQueue.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed:`, err);
  });

  processingQueue.on('completed', (job) => {
    console.log(`Job ${job.id} completed`);
  });
}

async function processWithVideoIndexer(itemId: string, userId: string): Promise<any> {
  // Get the blob name for the uploaded video (persisted at uploadUrl time)
  const row = await query(
    `SELECT video_blob_name FROM save_items WHERE id = $1 AND user_id = $2`,
    [itemId, userId]
  );

  let blobName: string | null = row.rows?.[0]?.video_blob_name || null;

  // Backwards-compatible fallback: try to find any .mp4 under `${itemId}/`
  if (!blobName) {
    const blobs = await listBlobs(`${itemId}/`);
    const mp4 = blobs.find(b => b.toLowerCase().endsWith('.mp4')) || null;
    if (mp4) {
      blobName = mp4;
      // Persist so future runs don't need to scan
      await query(
        `UPDATE save_items SET video_blob_name = $2, updated_at = NOW() WHERE id = $1`,
        [itemId, blobName]
      );
    }
  }

  if (!blobName) {
    throw new Error('No uploaded video blob found for this item (video_blob_name is missing)');
  }

  // Get the blob URL for the uploaded video
  const blobUrl = await getBlobUrl(blobName);

  // Submit to Video Indexer
  const videoId = await indexVideo(blobUrl, `tiksave-${itemId}`);

  // Poll for completion (with timeout)
  const maxWaitTime = 10 * 60 * 1000; // 10 minutes
  const pollInterval = 10 * 1000; // 10 seconds
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    const result = await getVideoIndex(videoId);

    if (result.state === 'Processed') {
      return {
        ...result.insights,
        videoIndexerId: videoId,
        thumbnailUrl: result.insights?.thumbnailUrl
          ? await getThumbnailUrl(videoId, result.insights.thumbnailUrl)
          : null,
      };
    }

    if (result.state === 'Failed') {
      throw new Error('Video indexing failed');
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error('Video indexing timed out');
}

function normalizeInsights(insights: any, rawSharedText?: string): {
  topics: string[];
  labels: string[];
  transcript: string | null;
  creator: string | null;
  duration: number | null;
} {
  // Handle Video Indexer format
  if (insights.transcript && Array.isArray(insights.transcript)) {
    return {
      topics: (insights.topics || []).map((t: any) => t.name || t),
      labels: (insights.labels || []).map((l: any) => l.name || l),
      transcript: insights.transcript.map((t: any) => t.text).join(' '),
      creator: null,
      duration: insights.duration || null,
    };
  }

  // Handle URL-only analysis format
  return {
    topics: insights.topics || [],
    labels: insights.labels || [],
    transcript: null,
    creator: insights.creator || null,
    duration: null,
  };
}

function generateTitle(transcript: string | null, rawSharedText: string | null): string {
  // Try to use first sentence of transcript
  if (transcript) {
    const sentences = transcript.split(/[.!?]+/);
    if (sentences[0] && sentences[0].length > 10) {
      return sentences[0].trim().slice(0, 100);
    }
  }

  // Use shared text (without hashtags)
  if (rawSharedText) {
    const withoutHashtags = rawSharedText.replace(/#[\w]+/g, '').trim();
    if (withoutHashtags.length > 5) {
      return withoutHashtags.slice(0, 100);
    }
  }

  return 'TikTok Video';
}

async function updateItemStatus(itemId: string, status: string): Promise<void> {
  await query(
    'UPDATE save_items SET status = $1, updated_at = NOW() WHERE id = $2',
    [status, itemId]
  );
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, closing queue...');
  await processingQueue.close();
  process.exit(0);
});
