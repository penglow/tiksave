import { DefaultAzureCredential } from '@azure/identity';

interface VideoIndexerConfig {
  subscriptionId: string;
  resourceGroup: string;
  accountId: string;
  location: string;
}

interface IndexingResult {
  videoId: string;
  state: string;
  insights?: VideoInsights;
}

interface VideoInsights {
  transcript: TranscriptItem[];
  topics: TopicItem[];
  labels: LabelItem[];
  keywords: KeywordItem[];
  faces: FaceItem[];
  ocr: OcrItem[];
  duration: number;
  thumbnailUrl?: string;
}

interface TranscriptItem {
  text: string;
  confidence: number;
  startTime: number;
  endTime: number;
  speakerId?: number;
}

interface TopicItem {
  name: string;
  confidence: number;
  referenceUrl?: string;
}

interface LabelItem {
  name: string;
  confidence: number;
  instances: Array<{ startTime: number; endTime: number }>;
}

interface KeywordItem {
  text: string;
  confidence: number;
}

interface FaceItem {
  name?: string;
  confidence: number;
}

interface OcrItem {
  text: string;
  confidence: number;
}

// Get access token for Video Indexer API
async function getAccessToken(config: VideoIndexerConfig): Promise<string> {
  const credential = new DefaultAzureCredential();
  
  // Get ARM access token
  const armToken = await credential.getToken('https://management.azure.com/.default');
  
  // Exchange for Video Indexer access token
  const response = await fetch(
    `https://management.azure.com/subscriptions/${config.subscriptionId}/resourceGroups/${config.resourceGroup}/providers/Microsoft.VideoIndexer/accounts/${config.accountId}/generateAccessToken?api-version=2024-01-01`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${armToken.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        permissionType: 'Contributor',
        scope: 'Account',
      }),
    }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to get Video Indexer access token: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.accessToken;
}

/**
 * Submit a video for indexing
 */
export async function indexVideo(
  videoUrl: string,
  videoName: string
): Promise<string> {
  const config = getConfig();
  const accessToken = await getAccessToken(config);
  
  const apiUrl = `https://api.videoindexer.ai/${config.location}/Accounts/${config.accountId}/Videos`;
  
  const params = new URLSearchParams({
    accessToken,
    name: videoName,
    videoUrl,
    language: 'auto',
    indexingPreset: 'Default', // Use AudioVideoInsights for more features
    privacy: 'Private',
    sendSuccessEmail: 'false',
  });
  
  const response = await fetch(`${apiUrl}?${params}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to submit video for indexing: ${error}`);
  }
  
  const data = await response.json();
  return data.id; // Return the video indexer ID
}

/**
 * Get the status and results of a video indexing job
 */
export async function getVideoIndex(videoId: string): Promise<IndexingResult> {
  const config = getConfig();
  const accessToken = await getAccessToken(config);
  
  const apiUrl = `https://api.videoindexer.ai/${config.location}/Accounts/${config.accountId}/Videos/${videoId}/Index`;
  
  const response = await fetch(`${apiUrl}?accessToken=${accessToken}`, {
    method: 'GET',
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get video index: ${error}`);
  }
  
  const data = await response.json();
  
  return {
    videoId,
    state: data.state, // 'Processing', 'Processed', 'Failed'
    insights: data.state === 'Processed' ? parseInsights(data) : undefined,
  };
}

/**
 * Get thumbnail URL for a video
 */
export async function getThumbnailUrl(videoId: string, thumbnailId: string): Promise<string> {
  const config = getConfig();
  const accessToken = await getAccessToken(config);
  
  return `https://api.videoindexer.ai/${config.location}/Accounts/${config.accountId}/Videos/${videoId}/Thumbnails/${thumbnailId}?accessToken=${accessToken}&format=Jpeg`;
}

/**
 * Delete a video from Video Indexer
 */
export async function deleteVideo(videoId: string): Promise<void> {
  const config = getConfig();
  const accessToken = await getAccessToken(config);
  
  const apiUrl = `https://api.videoindexer.ai/${config.location}/Accounts/${config.accountId}/Videos/${videoId}`;
  
  await fetch(`${apiUrl}?accessToken=${accessToken}`, {
    method: 'DELETE',
  });
}

// Parse Video Indexer response into our format
function parseInsights(data: any): VideoInsights {
  const videos = data.videos?.[0];
  const insights = videos?.insights || {};
  
  // Parse transcript
  const transcript: TranscriptItem[] = [];
  if (insights.transcript) {
    for (const item of insights.transcript) {
      transcript.push({
        text: item.text,
        confidence: item.confidence,
        startTime: parseTimeToSeconds(item.instances?.[0]?.start || '0:00:00'),
        endTime: parseTimeToSeconds(item.instances?.[0]?.end || '0:00:00'),
        speakerId: item.speakerId,
      });
    }
  }
  
  // Parse topics
  const topics: TopicItem[] = [];
  if (insights.topics) {
    for (const topic of insights.topics) {
      topics.push({
        name: topic.name,
        confidence: topic.confidence,
        referenceUrl: topic.referenceUrl,
      });
    }
  }
  
  // Parse labels
  const labels: LabelItem[] = [];
  if (insights.labels) {
    for (const label of insights.labels) {
      labels.push({
        name: label.name,
        confidence: label.instances?.[0]?.confidence || 0,
        instances: (label.instances || []).map((inst: any) => ({
          startTime: parseTimeToSeconds(inst.start),
          endTime: parseTimeToSeconds(inst.end),
        })),
      });
    }
  }
  
  // Parse keywords
  const keywords: KeywordItem[] = [];
  if (insights.keywords) {
    for (const keyword of insights.keywords) {
      keywords.push({
        text: keyword.text,
        confidence: keyword.confidence,
      });
    }
  }
  
  // Parse faces (named entities)
  const faces: FaceItem[] = [];
  if (insights.faces) {
    for (const face of insights.faces) {
      faces.push({
        name: face.name,
        confidence: face.confidence,
      });
    }
  }
  
  // Parse OCR (on-screen text)
  const ocr: OcrItem[] = [];
  if (insights.ocr) {
    for (const item of insights.ocr) {
      ocr.push({
        text: item.text,
        confidence: item.confidence,
      });
    }
  }
  
  return {
    transcript,
    topics,
    labels,
    keywords,
    faces,
    ocr,
    duration: videos?.durationInSeconds || 0,
    thumbnailUrl: videos?.thumbnailId,
  };
}

// Parse time string (HH:MM:SS.mmm) to seconds
function parseTimeToSeconds(timeStr: string): number {
  const parts = timeStr.split(':');
  if (parts.length !== 3) return 0;
  
  const hours = parseInt(parts[0]);
  const minutes = parseInt(parts[1]);
  const seconds = parseFloat(parts[2]);
  
  return hours * 3600 + minutes * 60 + seconds;
}

function getConfig(): VideoIndexerConfig {
  return {
    subscriptionId: process.env.AZURE_SUBSCRIPTION_ID!,
    resourceGroup: process.env.AZURE_RESOURCE_GROUP!,
    accountId: process.env.AZURE_VIDEO_INDEXER_ACCOUNT_ID!,
    location: process.env.AZURE_VIDEO_INDEXER_LOCATION || 'trial',
  };
}

/**
 * Analyze a video URL to extract metadata (Mode A - link only)
 * Falls back to basic analysis when we can't download the video
 */
export async function analyzeUrlOnly(url: string, sharedText?: string): Promise<{
  topics: string[];
  labels: string[];
  creator?: string;
  hashtags: string[];
}> {
  const result = {
    topics: [] as string[],
    labels: [] as string[],
    creator: undefined as string | undefined,
    hashtags: [] as string[],
  };
  
  // Extract creator from URL
  const creatorMatch = url.match(/tiktok\.com\/@([\w.-]+)/);
  if (creatorMatch) {
    result.creator = `@${creatorMatch[1]}`;
  }
  
  // Extract hashtags from shared text
  if (sharedText) {
    const hashtagMatches = sharedText.match(/#[\w]+/g);
    if (hashtagMatches) {
      result.hashtags = hashtagMatches.map(h => h.toLowerCase());
    }
    
    // Infer topics from hashtags
    result.topics = inferTopicsFromHashtags(result.hashtags);
    result.labels = inferLabelsFromText(sharedText);
  }
  
  return result;
}

function inferTopicsFromHashtags(hashtags: string[]): string[] {
  const topicMap: { [key: string]: string[] } = {
    'Japan': ['#japan', '#tokyo', '#osaka', '#kyoto', '#japanese', '#nippon'],
    'Korea': ['#korea', '#seoul', '#korean', '#kpop', '#kdrama'],
    'Food': ['#food', '#foodie', '#cooking', '#recipe', '#ramen', '#sushi', '#eat', '#yummy'],
    'Travel': ['#travel', '#vacation', '#trip', '#holiday', '#explore', '#wanderlust'],
    'Fitness': ['#gym', '#fitness', '#workout', '#exercise', '#fit', '#gains', '#training'],
    'Fashion': ['#fashion', '#style', '#outfit', '#ootd', '#clothes', '#aesthetic'],
    'Beauty': ['#beauty', '#makeup', '#skincare', '#cosmetics', '#glow'],
    'Tech': ['#tech', '#technology', '#gadgets', '#iphone', '#android'],
    'Finance': ['#finance', '#investing', '#money', '#stocks', '#crypto'],
    'Cars': ['#car', '#cars', '#auto', '#automotive', '#vehicle'],
  };
  
  const detectedTopics = new Set<string>();
  
  for (const hashtag of hashtags) {
    for (const [topic, keywords] of Object.entries(topicMap)) {
      if (keywords.includes(hashtag)) {
        detectedTopics.add(topic);
      }
    }
  }
  
  return Array.from(detectedTopics);
}

function inferLabelsFromText(text: string): string[] {
  const labels: string[] = [];
  const textLower = text.toLowerCase();
  
  const labelKeywords: { [key: string]: string[] } = {
    'restaurant': ['restaurant', 'dining', 'eat at', 'reservation'],
    'hotel': ['hotel', 'stay at', 'room tour', 'check in', 'lobby'],
    'shopping': ['shopping', 'haul', 'bought', 'store', 'mall'],
    'attraction': ['visit', 'temple', 'shrine', 'museum', 'landmark'],
    'street food': ['street food', 'food stall', 'market'],
    'cafe': ['cafe', 'coffee', 'coffeeshop'],
  };
  
  for (const [label, keywords] of Object.entries(labelKeywords)) {
    if (keywords.some(kw => textLower.includes(kw))) {
      labels.push(label);
    }
  }
  
  return labels;
}

