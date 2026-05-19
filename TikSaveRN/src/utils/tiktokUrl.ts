/**
 * TikTok URL extraction from free text and share/deep-link payloads.
 */

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/**
 * Extract the first TikTok video URL from arbitrary text.
 *
 * @param text - Raw text that may contain a TikTok link.
 * @returns Matched URL or `null` if none found.
 */
export function extractTikTokUrl(text: string): string | null {
  const patterns = [
    /https?:\/\/(?:www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+[^\s]*/i,
    /https?:\/\/vm\.tiktok\.com\/[\w]+[^\s]*/i,
    /https?:\/\/(?:www\.)?tiktok\.com\/t\/[\w]+[^\s]*/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }

  return null;
}

/**
 * Extract a TikTok URL from an incoming deep link or share intent URL.
 * Handles `url` / `text` query params and double-encoded values.
 *
 * @param incomingUrl - Full incoming URL from the OS share sheet or deep link.
 */
export function extractTikTokUrlFromIncomingUrl(incomingUrl: string): string | null {
  if (!incomingUrl) return null;

  // Direct URL in payload
  const direct = extractTikTokUrl(incomingUrl);
  if (direct) return direct;

  try {
    const parsed = new URL(incomingUrl);
    const urlParam = parsed.searchParams.get('url');
    const textParam = parsed.searchParams.get('text');
    const shared = urlParam || textParam;
    if (!shared) return null;

    // URLSearchParams already decodes once, so try raw first.
    const fromRaw = extractTikTokUrl(shared);
    if (fromRaw) return fromRaw;

    // Fallback for providers that double-encode payload values.
    try {
      return extractTikTokUrl(decodeURIComponent(shared));
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}
