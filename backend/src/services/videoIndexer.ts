import { DefaultAzureCredential } from '@azure/identity';
import * as cheerio from 'cheerio';
import { getOpenAIClient, isOpenAIConfigured, withRetry } from './openai.js';

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

  const data = await response.json() as { accessToken: string };
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

  const data = await response.json() as { id: string };
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

  const data = await response.json() as { state: string;[key: string]: unknown };

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
 * Analyze a video URL - fetch metadata and use AI for smart categorization
 */
export async function analyzeUrlOnly(url: string, sharedText?: string): Promise<{
  topics: string[];
  labels: string[];
  creator?: string;
  hashtags: string[];
  thumbnailUrl?: string;
  title?: string;
  description?: string;
}> {
  console.log('🔍 Analyzing URL:', url);

  const result = {
    topics: [] as string[],
    labels: [] as string[],
    creator: undefined as string | undefined,
    hashtags: [] as string[],
    thumbnailUrl: undefined as string | undefined,
    title: undefined as string | undefined,
    description: undefined as string | undefined,
  };

  // Extract creator from URL
  const creatorMatch = url.match(/tiktok\.com\/@([\w.-]+)/);
  if (creatorMatch) {
    result.creator = creatorMatch[1];
    console.log('👤 Creator:', result.creator);
  }

  // Extract hashtags from shared text
  if (sharedText) {
    const hashtagMatches = sharedText.match(/#[\w\u4e00-\u9fff]+/g);
    if (hashtagMatches) {
      result.hashtags = hashtagMatches.map(h => h.replace('#', '').toLowerCase());
      console.log('#️⃣ Hashtags:', result.hashtags);
    }
  }

  // Fetch TikTok page metadata (thumbnail, title, description)
  try {
    console.log('🌐 Fetching TikTok metadata...');
    const metadata = await fetchTikTokMetadata(url);
    if (metadata) {
      result.thumbnailUrl = metadata.thumbnailUrl;
      result.title = metadata.title;
      result.description = metadata.description;
      console.log('📷 Thumbnail:', result.thumbnailUrl ? 'found' : 'not found');
      console.log('📝 Title:', result.title);
    }
  } catch (error) {
    console.warn('⚠️ Failed to fetch TikTok metadata:', error);
  }

  // Use AI to generate smart categories
  const contentForAI = [
    result.title,
    result.description,
    sharedText,
    result.hashtags.length > 0 ? `Hashtags: ${result.hashtags.join(', ')}` : '',
    result.creator ? `Creator: @${result.creator}` : '',
  ].filter(Boolean).join('\n');

  if (contentForAI.trim()) {
    try {
      console.log('🤖 Using AI to categorize...');
      const aiCategories = await generateAICategories(contentForAI);
      result.topics = aiCategories.categories;
      result.labels = aiCategories.labels;
      console.log('🏷️ AI Categories:', result.topics);
      console.log('🔖 AI Labels:', result.labels);
    } catch (error) {
      console.warn('⚠️ AI categorization failed, using fallback:', error);
      result.topics = inferTopicsFallback(contentForAI);
    }
  } else {
    result.topics = ['Saved'];
  }

  console.log('✅ Analysis complete');
  return result;
}

/**
 * Extract video ID from TikTok URL
 */
function extractVideoId(url: string): string | null {
  // Pattern: https://www.tiktok.com/@username/video/VIDEO_ID
  const match = url.match(/\/video\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Try to construct thumbnail URL from video ID (fallback method)
 */
function constructThumbnailUrl(videoId: string): string {
  // TikTok CDN pattern - try multiple known patterns
  // Note: These patterns may change, but worth trying
  return `https://p16-sign-va.tiktokcdn.com/obj/tos-useast2a-p-0037-aiso/${videoId}/?lk=3&nonce=xxx&refresh_token=xxx&shp=xxx&shcp=xxx`;
}

/**
 * Fetch metadata from TikTok page using multiple methods
 */
async function fetchTikTokMetadata(url: string): Promise<{
  thumbnailUrl?: string;
  title?: string;
  description?: string;
} | null> {
  // Resolve short links (vm.tiktok.com, vt.tiktok.com) to get canonical URL with Video ID
  let canonicalUrl = url;
  if (url.includes('vm.tiktok.com') || url.includes('vt.tiktok.com')) {
    try {
      console.log('🔗 Resolving short URL:', url);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }
      });
      clearTimeout(timeout);

      if (response.url && response.url !== url) {
        canonicalUrl = response.url;
        console.log('🔗 Resolved to:', canonicalUrl);
      }
    } catch (e) {
      console.warn('⚠️ Failed to resolve short URL:', e);
    }
  }

  const videoId = extractVideoId(canonicalUrl);
  let thumbnailUrl: string | undefined;
  let title: string | undefined;
  let description: string | undefined;

  // Update check to use canonical URL for oEmbed if available
  const urlToUse = canonicalUrl || url;

  // Method 1: Try TikTok's embed/oEmbed endpoint (most reliable)
  if (videoId) {
    try {
      // Try multiple oEmbed endpoints
      const embedUrls = [
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(urlToUse)}`,
        `https://api.tiktok.com/oembed?url=${encodeURIComponent(urlToUse)}`,
      ];

      for (const embedUrl of embedUrls) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);

          const response = await fetch(embedUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json',
            },
            signal: controller.signal,
          });

          clearTimeout(timeout);

          if (response.ok) {
            const data = await response.json() as { thumbnail_url?: string; title?: string };
            if (data.thumbnail_url) {
              thumbnailUrl = data.thumbnail_url;
              title = data.title;
              console.log('📷 Got thumbnail from oEmbed API ✅');
              return { thumbnailUrl, title, description };
            }
          }
        } catch (e) {
          // Try next endpoint
          continue;
        }
      }
    } catch (error) {
      console.log('⚠️ oEmbed method failed, trying alternatives...');
    }
  }

  // Method 2: Try direct page scraping with better headers
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    // Try with vm.tiktok.com (mobile version, sometimes easier to scrape)
    const mobileUrl = url.replace('www.tiktok.com', 'vm.tiktok.com');

    const response = await fetch(mobileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.tiktok.com/',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (response.ok) {
      const html = await response.text();
      const $ = cheerio.load(html);

      // Try to find thumbnail in various places
      thumbnailUrl = $('meta[property="og:image"]').attr('content') ||
        $('meta[name="twitter:image"]').attr('content') ||
        $('meta[property="og:image:secure_url"]').attr('content') ||
        $('img[alt*="video"]').first().attr('src') ||
        $('img').filter((i, el) => {
          const src = $(el).attr('src') || '';
          return src.includes('tiktokcdn.com') || src.includes('cover');
        }).first().attr('src');

      title = $('meta[property="og:title"]').attr('content') ||
        $('meta[name="twitter:title"]').attr('content');

      description = $('meta[property="og:description"]').attr('content') ||
        $('meta[name="description"]').attr('content');

      // Try to extract from JSON in script tags
      if (!thumbnailUrl) {
        const scriptTags = $('script[type="application/json"]');
        for (let i = 0; i < scriptTags.length; i++) {
          try {
            const data = JSON.parse($(scriptTags[i]).html() || '{}');
            const cover = data?.props?.pageProps?.videoData?.itemInfo?.itemStruct?.video?.cover ||
              data?.props?.pageProps?.videoData?.itemInfo?.itemStruct?.cover ||
              data?.videoData?.cover;
            if (cover) {
              thumbnailUrl = cover;
              break;
            }
          } catch (e) {
            // Continue
          }
        }
      }

      if (thumbnailUrl) {
        console.log('📷 Got thumbnail from page scraping ✅');
      }
    }
  } catch (error) {
    console.log('⚠️ Page scraping failed, trying fallback...');
  }

  // Method 3: Try using TikTok's share embed endpoint
  if (!thumbnailUrl && videoId) {
    try {
      // TikTok's share page sometimes has better metadata
      const shareUrl = `https://www.tiktok.com/t/${videoId}/`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(shareUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        const html = await response.text();
        const $ = cheerio.load(html);
        const ogImage = $('meta[property="og:image"]').attr('content');
        if (ogImage) {
          thumbnailUrl = ogImage;
          console.log('📷 Got thumbnail from share page ✅');
        }
      }
    } catch (error) {
      // Share page might not work
    }
  }

  // Method 4: Try original URL with different approach
  if (!thumbnailUrl) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.google.com/',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        const html = await response.text();
        const $ = cheerio.load(html);
        thumbnailUrl = $('meta[property="og:image"]').attr('content');
      }
    } catch (error) {
      // Last resort failed
    }
  }

  // Clean up thumbnail URL (but don't be too strict)
  if (thumbnailUrl) {
    // Clean up the URL
    thumbnailUrl = thumbnailUrl.trim();

    // Ensure it's a valid URL format
    if (!thumbnailUrl.startsWith('http://') && !thumbnailUrl.startsWith('https://')) {
      console.log('⚠️ Invalid thumbnail URL format, discarding:', thumbnailUrl);
      thumbnailUrl = undefined;
    } else {
      // Don't remove query parameters - TikTok URLs often need them
      // Just log what we found
      console.log('📷 Final thumbnail URL:', thumbnailUrl.substring(0, 100) + '...');
    }
  }

  console.log('📷 Final thumbnail result:', thumbnailUrl ? `✅ Found (${thumbnailUrl.length} chars)` : '❌ Not found');

  return { thumbnailUrl, title, description };
}

/**
 * Use OpenAI to generate smart, hierarchical categories
 */
async function generateAICategories(content: string): Promise<{
  categories: string[];
  labels: string[];
}> {
  if (!isOpenAIConfigured()) {
    throw new Error('OpenAI API key not configured');
  }

  const openai = getOpenAIClient();

  const prompt = `Analyze this TikTok video content and categorize it.

Content:
${content}

Generate a HIERARCHICAL category structure using ">" to separate parent and subcategory.

Format: "Parent Category > Specific Subcategory"

Parent categories to use (pick the most relevant):
- Food (for anything food/cooking/restaurant related)
- Travel (for travel vlogs, destination guides, hotels)
- Fitness (for workouts, gym, health)
- Fashion (for outfits, style, clothing)
- Beauty (for makeup, skincare, haircare)
- Tech (for gadgets, apps, reviews)
- Entertainment (for comedy, music, dance, gaming)
- Lifestyle (for daily life, tips, motivation)
- Education (for learning, tutorials, how-tos)
- Cars (for automotive content)
- Pets (for animal content)
- Finance (for money, investing, business)

Examples of GOOD hierarchical categories:
- "Food > Japanese Street Food"
- "Food > Korean BBQ"
- "Travel > Tokyo Guide"
- "Travel > Hotel Reviews"
- "Fitness > Home Workouts"
- "Fitness > Gym Motivation"
- "Beauty > Korean Skincare"
- "Entertainment > Dance Choreography"
- "Tech > iPhone Tips"

Generate 1-2 hierarchical categories. Be specific with subcategories.
Also provide 2-4 descriptive tags.

Respond in JSON:
{
  "categories": ["Parent > Subcategory"],
  "labels": ["tag1", "tag2"]
}`;

  const response = await withRetry(() =>
    openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 150,
    })
  );

  const text = response.choices[0]?.message?.content || '';
  console.log('🤖 AI Response:', text);

  try {
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        categories: parsed.categories || ['Saved'],
        labels: parsed.labels || [],
      };
    }
  } catch {
    console.warn('Failed to parse AI response:', text);
  }

  return { categories: ['Saved'], labels: [] };
}

/**
 * Generate rich semantic context description for better search
 * This creates a comprehensive, context-aware description that captures the essence
 * and meaning of the video content, enabling semantic search to understand context
 * rather than just matching keywords.
 */
export async function generateSemanticContext(content: {
  title?: string;
  transcript?: string;
  topics?: string[];
  labels?: string[];
  keywords?: string[];
  rawSharedText?: string;
  description?: string;
}): Promise<{
  semanticContext: string;
}> {
  if (!isOpenAIConfigured()) {
    console.warn('OpenAI API key not configured, skipping semantic context generation');
    return {
      semanticContext: '',
    };
  }

  try {
    const openai = getOpenAIClient();

    // Combine all available content for context understanding
    const contentParts: string[] = [];
    if (content.title) contentParts.push(`Title: ${content.title}`);
    if (content.description) contentParts.push(`Description: ${content.description}`);
    if (content.transcript) contentParts.push(`Transcript: ${content.transcript.slice(0, 3000)}`);
    if (content.topics && content.topics.length > 0) contentParts.push(`Topics: ${content.topics.join(', ')}`);
    if (content.labels && content.labels.length > 0) contentParts.push(`Labels: ${content.labels.join(', ')}`);
    if (content.keywords && content.keywords.length > 0) {
      const keywordTexts = Array.isArray(content.keywords)
        ? content.keywords.map((k: any) => typeof k === 'string' ? k : k.text || k.name || String(k))
        : [];
      if (keywordTexts.length > 0) {
        contentParts.push(`Keywords: ${keywordTexts.join(', ')}`);
      }
    }
    if (content.rawSharedText) contentParts.push(`Shared Text: ${content.rawSharedText}`);

    const combinedContent = contentParts.join('\n\n');

    if (!combinedContent.trim()) {
      return {
        semanticContext: '',
      };
    }

    const prompt = `Analyze this video content and create a rich, comprehensive semantic context description that captures the full meaning and essence of the video.

The goal is to create a natural, flowing description that enables semantic search to understand the video's context, themes, and related concepts - not just match keywords.

This description should:
- Explain what the video is about in natural language
- Capture the main themes, topics, and concepts
- Include related concepts, synonyms, and broader categories
- Describe the context, setting, or situation
- Mention related entities, brands, products, or services when relevant
- Use natural language that captures semantic meaning

Examples:
- For a video about Popeyes: "A food review or vlog featuring Popeyes, a fast food restaurant chain known for fried chicken. The video likely shows or discusses their chicken menu items, possibly including fried chicken, chicken sandwiches, or spicy Louisiana-style chicken. This is restaurant content, fast food content, and food review content."
- For a video about Tokyo travel: "A travel vlog or guide about Tokyo, Japan. The video likely features travel experiences, tourist attractions, cultural sites, food experiences, or travel tips. This is travel content, Japan travel content, and tourism content."

Write a comprehensive 3-5 sentence description that captures the semantic context. Write it as natural, flowing prose - not a list of keywords.

Content to analyze:
${combinedContent}

Respond with just the semantic context description (no JSON, no labels, just the description text):`;

    const response = await withRetry(() =>
      openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6, // Balanced temperature for natural language generation
        max_tokens: 400,
      })
    );

    const semanticContext = response.choices[0]?.message?.content?.trim() || '';

    if (semanticContext) {
      console.log(`✅ Generated semantic context (${semanticContext.length} chars)`);
      console.log(`   Context: ${semanticContext.substring(0, 150)}...`);
    } else {
      console.warn('⚠️ No semantic context generated');
    }

    return {
      semanticContext,
    };
  } catch (error) {
    console.error('❌ Error generating semantic context:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
    }
    return {
      semanticContext: '',
    };
  }
}

// Legacy function for backwards compatibility - converts to old format
export async function generateSemanticKeywords(content: {
  title?: string;
  transcript?: string;
  topics?: string[];
  labels?: string[];
  keywords?: string[];
  rawSharedText?: string;
  description?: string;
}): Promise<{
  semanticKeywords: string[];
  semanticDescription: string;
}> {
  const result = await generateSemanticContext(content);
  return {
    semanticKeywords: [], // No longer used - context is better
    semanticDescription: result.semanticContext,
  };
}

/**
 * Fallback topic inference when AI is not available - uses hierarchical format
 */
function inferTopicsFallback(text: string): string[] {
  const textLower = text.toLowerCase();
  const topics: string[] = [];

  // Hierarchical patterns: "Parent > Subcategory"
  const patterns: [string, string[]][] = [
    ['Food > Japanese Cuisine', ['ramen', 'sushi', 'japanese food', 'tokyo eats', 'izakaya']],
    ['Food > Korean Cuisine', ['korean food', 'kbbq', 'korean bbq', 'kimchi', 'bibimbap']],
    ['Food > Street Food', ['street food', 'food stall', 'night market', 'food tour']],
    ['Food > Recipes', ['recipe', 'cooking', 'cook', 'baking', 'homemade']],
    ['Food > Restaurant Reviews', ['restaurant', 'cafe', 'dining', 'food review']],
    ['Travel > Japan', ['tokyo', 'osaka', 'kyoto', 'japan', 'shibuya', 'shinjuku']],
    ['Travel > Korea', ['seoul', 'korea', 'busan', 'gangnam', 'hongdae']],
    ['Travel > Hotels', ['hotel', 'room tour', 'resort', 'airbnb', 'stay']],
    ['Travel > Adventures', ['travel', 'trip', 'vacation', 'explore', 'adventure']],
    ['Fitness > Gym', ['gym', 'lifting', 'gains', 'deadlift', 'squat', 'bench']],
    ['Fitness > Home Workouts', ['home workout', 'no equipment', 'bodyweight', 'at home']],
    ['Fitness > Cardio', ['running', 'cardio', 'hiit', 'jump rope']],
    ['Fashion > Outfits', ['outfit', 'ootd', 'fit check', 'what i wore']],
    ['Fashion > Style Tips', ['fashion', 'style', 'fashion tips', 'styling']],
    ['Beauty > Skincare', ['skincare', 'skin routine', 'skincare routine', 'moisturizer']],
    ['Beauty > Makeup', ['makeup', 'grwm', 'get ready', 'makeup tutorial']],
    ['Tech > Reviews', ['iphone', 'tech', 'gadget', 'review', 'unboxing']],
    ['Tech > Tips', ['tips', 'tricks', 'hack', 'shortcut']],
    ['Entertainment > Comedy', ['funny', 'comedy', 'humor', 'laugh', 'meme']],
    ['Entertainment > Dance', ['dance', 'choreography', 'dancer', 'moves']],
    ['Entertainment > Music', ['music', 'song', 'cover', 'singing', 'singer']],
    ['Entertainment > Gaming', ['gaming', 'game', 'gameplay', 'streamer', 'twitch']],
    ['Pets > Dogs', ['dog', 'puppy', 'doggo', 'pup']],
    ['Pets > Cats', ['cat', 'kitten', 'kitty', 'meow']],
    ['Cars > Reviews', ['car', 'supercar', 'automotive', 'car review']],
    ['Lifestyle > Tips', ['hack', 'tip', 'diy', 'tutorial', 'life hack']],
    ['Finance > Investing', ['invest', 'stock', 'crypto', 'trading']],
    ['Finance > Money Tips', ['money', 'budget', 'saving', 'finance']],
  ];

  for (const [topic, keywords] of patterns) {
    if (keywords.some(kw => textLower.includes(kw))) {
      topics.push(topic);
      break; // Only take the first match for cleaner categorization
    }
  }

  return topics.length > 0 ? topics : ['Saved'];
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

