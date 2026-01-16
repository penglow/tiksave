import { Browserbase } from '@browserbasehq/sdk';

let browserbaseClient: Browserbase | null = null;

function getBrowserbaseClient(): Browserbase | null {
  // For dev purposes - use provided key or env variable
  const apiKey = process.env.BROWSERBASE_API_KEY || 'bb_live_PG-xzGRKdX7CsUIuWfNJz4gi8Sg';
  
  if (!apiKey) {
    console.log('⚠️ Browserbase API key not configured, skipping browser-based extraction');
    return null;
  }

  if (!browserbaseClient) {
    browserbaseClient = new Browserbase({
      apiKey: apiKey,
    });
    console.log('✅ Browserbase client initialized');
  }

  return browserbaseClient;
}

/**
 * Extract TikTok thumbnail using Browserbase (headless browser)
 * This method can handle JavaScript-rendered content
 */
export async function extractThumbnailWithBrowserbase(url: string): Promise<{
  thumbnailUrl?: string;
  title?: string;
  description?: string;
} | null> {
  const client = getBrowserbaseClient();
  if (!client) {
    return null;
  }

  try {
    console.log('🌐 Using Browserbase to extract TikTok thumbnail...');

    // Create a session using Browserbase SDK
    // The SDK structure: client.sessions.create() returns a session object
    const session = await (client as any).sessions.create({
      url: url,
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    const sessionId = session.id || session.sessionId || session;
    console.log('📱 Browserbase session created:', sessionId);

    // Wait a moment for page to fully load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get the page HTML content after JavaScript execution
    let pageContent: string;
    try {
      // Try the getContent method
      const contentResponse = await (client as any).sessions.getContent(sessionId);
      pageContent = typeof contentResponse === 'string' ? contentResponse : contentResponse.html || contentResponse.content || '';
    } catch (e) {
      // Try alternative: get the page as HTML
      try {
        pageContent = await (client as any).sessions.getHTML(sessionId);
      } catch (e2) {
        // Try using the session's page property if available
        pageContent = await (client as any).sessions.get(sessionId).then((s: any) => s.html || s.content || '');
      }
    }

    if (!pageContent || pageContent.length < 100) {
      console.log('⚠️ Browserbase returned empty or very short content');
      await (client as any).sessions.delete(sessionId).catch(() => {});
      return null;
    }

    // Extract thumbnail from the fully rendered page
    // TikTok embeds the thumbnail in og:image meta tag
    const ogImageMatch = pageContent.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    const ogTitleMatch = pageContent.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
    const ogDescMatch = pageContent.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);

    // Also try to find thumbnail in JSON-LD or embedded data
    let thumbnailUrl = ogImageMatch ? ogImageMatch[1] : undefined;
    let title = ogTitleMatch ? ogTitleMatch[1] : undefined;
    let description = ogDescMatch ? ogDescMatch[1] : undefined;

    // Try to extract from embedded JSON data
    if (!thumbnailUrl) {
      const jsonMatch = pageContent.match(/<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i);
      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[1]);
          thumbnailUrl = data?.props?.pageProps?.videoData?.itemInfo?.itemStruct?.video?.cover ||
                        data?.props?.pageProps?.videoData?.itemInfo?.itemStruct?.cover ||
                        data?.videoData?.cover;
        } catch (e) {
          // JSON parse failed, continue
        }
      }
    }

    // Clean up the session
    try {
      await (client.sessions as any).delete(sessionId);
      console.log('🧹 Browserbase session cleaned up');
    } catch (e) {
      // Session cleanup failed, but that's okay
      console.log('⚠️ Could not delete Browserbase session:', e instanceof Error ? e.message : 'Unknown error');
    }

    if (thumbnailUrl) {
      console.log('📷 Got thumbnail from Browserbase ✅');
      return { thumbnailUrl, title, description };
    }

    console.log('⚠️ Browserbase extraction completed but no thumbnail found');
    return null;
  } catch (error) {
    console.error('❌ Browserbase extraction failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return null;
  }
}

/**
 * Alternative: Use Playwright directly (if Browserbase is not available)
 * This requires Playwright to be installed and configured
 */
export async function extractThumbnailWithPlaywright(url: string): Promise<{
  thumbnailUrl?: string;
  title?: string;
  description?: string;
} | null> {
  try {
    // Dynamic import to avoid loading Playwright if not needed
    const { chromium } = await import('playwright');
    
    console.log('🌐 Using Playwright to extract TikTok thumbnail...');

    const browser = await chromium.launch({
      headless: true,
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    
    // Navigate to the page and wait for it to load
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Wait a bit for any lazy-loaded content
    await page.waitForTimeout(2000);

    // Extract metadata
    const thumbnailUrl = await page.$eval('meta[property="og:image"]', (el: Element) => el.getAttribute('content')).catch(() => null);
    const title = await page.$eval('meta[property="og:title"]', (el: Element) => el.getAttribute('content')).catch(() => null);
    const description = await page.$eval('meta[property="og:description"]', (el: Element) => el.getAttribute('content')).catch(() => null);

    await browser.close();

    if (thumbnailUrl) {
      console.log('📷 Got thumbnail from Playwright ✅');
      return { thumbnailUrl, title: title || undefined, description: description || undefined };
    }

    return null;
  } catch (error) {
    console.error('❌ Playwright extraction failed:', error);
    return null;
  }
}

