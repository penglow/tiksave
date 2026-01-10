import Queue from 'bull';
import { query } from '../database/init.js';
import { indexVideo, getVideoIndex, analyzeUrlOnly, getThumbnailUrl } from '../services/videoIndexer.js';
import { classifyItem } from '../services/classification.js';
import { generateItemEmbedding } from '../services/embeddings.js';
import { getBlobUrl } from '../services/storage.js';
import { extractHashtags } from '../utils/text.js';

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
      
      // Classify into folder
      const classification = await classifyItem(userId, {
        topics,
        labels,
        transcriptText: transcript,
        hashtags: extractHashtags(rawSharedText),
        creatorUsername: creator,
      });
      
      // Generate embedding for semantic search
      const embedding = await generateItemEmbedding({
        transcriptText: transcript,
        detectedTopics: topics,
        detectedLabels: labels,
        rawSharedText,
      });
      
      // Determine final status
      const HIGH_CONFIDENCE = 0.85;
      const MEDIUM_CONFIDENCE = 0.6;
      
      let status: string;
      let folderId: string | null = null;
      
      if (classification.confidence >= HIGH_CONFIDENCE && classification.folderId) {
        status = 'ready';
        folderId = classification.folderId;
      } else if (classification.confidence >= MEDIUM_CONFIDENCE && classification.folderId) {
        status = 'ready'; // Filed but might need review
        folderId = classification.folderId;
      } else {
        status = 'needs_review';
      }
      
      // Generate title from transcript or shared text
      const title = generateTitle(transcript, rawSharedText);
      
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
          updated_at = NOW()
         WHERE id = $15`,
        [
          status,
          thumbnailUrl,
          transcript,
          topics,
          labels,
          classification.folderId,
          classification.confidence,
          folderId,
          title,
          duration,
          creator,
          videoIndexerId,
          JSON.stringify(insights),
          embedding ? `[${embedding.join(',')}]` : null,
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
  // Get the blob URL for the uploaded video
  const blobUrl = await getBlobUrl(`${itemId}/video.mp4`);
  
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

