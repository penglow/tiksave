/**
 * Client-side TikTok oEmbed fetch and in-memory preview cache.
 * Same-origin as previews on the Add screen; cached per URL.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TikTokOEmbedPreview {
  url: string;
  title?: string;
  thumbnailUrl?: string;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

const previewByUrl = new Map<string, TikTokOEmbedPreview>();

function isProbablyTikTokUrl(url: string): boolean {
  const u = url.toLowerCase();
  return u.includes('tiktok.com') || u.includes('vm.tiktok');
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/**
 * Fetch title and thumbnail for a TikTok URL via the public oEmbed endpoint.
 * Results are cached in memory for the session.
 *
 * @param url - TikTok video URL to preview.
 */
export async function fetchTikTokOEmbedPreview(url: string): Promise<TikTokOEmbedPreview> {
  const trimmed = url.trim();
  const fallback: TikTokOEmbedPreview = { url: trimmed };

  if (!trimmed || !isProbablyTikTokUrl(trimmed)) {
    return fallback;
  }

  const cached = previewByUrl.get(trimmed);
  if (cached) return cached;

  try {
    const endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(trimmed)}`;
    const response = await fetch(endpoint);
    if (!response.ok) {
      previewByUrl.set(trimmed, fallback);
      return fallback;
    }
    const data = (await response.json()) as { title?: unknown; thumbnail_url?: unknown };
    const next: TikTokOEmbedPreview = {
      url: trimmed,
      title: typeof data?.title === 'string' ? data.title : undefined,
      thumbnailUrl: typeof data?.thumbnail_url === 'string' ? data.thumbnail_url : undefined,
    };
    previewByUrl.set(trimmed, next);
    return next;
  } catch {
    previewByUrl.set(trimmed, fallback);
    return fallback;
  }
}

/**
 * Convenience wrapper that returns only the oEmbed thumbnail URL.
 *
 * @param sourceURL - TikTok video URL.
 */
export async function fetchTikTokOEmbedThumbnail(sourceURL: string): Promise<string | undefined> {
  const p = await fetchTikTokOEmbedPreview(sourceURL);
  return p.thumbnailUrl;
}
