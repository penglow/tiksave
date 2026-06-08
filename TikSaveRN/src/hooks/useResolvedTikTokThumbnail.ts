/**
 * Resolves TikTok video thumbnails on the client when the server has none.
 * Server-side ingestion often misses thumbs because TikTok blocks datacenter IPs.
 */

import { useEffect, useState } from 'react';
import { fetchTikTokOEmbedThumbnail } from '../utils/tiktokOEmbed';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Prefer API/stored thumbnail; otherwise resolve via TikTok oEmbed on-device.
 *
 * @param sourceURL - Original TikTok video URL used for oEmbed lookup.
 * @param serverThumbnailURL - Thumbnail URL from the backend, if available.
 * @returns Resolved thumbnail URL, or `undefined` while loading or on failure.
 */
export function useResolvedTikTokThumbnail(
  sourceURL: string | undefined,
  serverThumbnailURL: string | undefined,
): string | undefined {
  const [resolved, setResolved] = useState<string | undefined>(serverThumbnailURL);

  useEffect(() => {
    let cancelled = false;

    if (serverThumbnailURL) {
      setResolved(serverThumbnailURL);
      return () => {
        cancelled = true;
      };
    }

    setResolved(undefined);

    const src = sourceURL?.trim();
    if (!src) {
      return () => {
        cancelled = true;
      };
    }

    void fetchTikTokOEmbedThumbnail(src).then((thumb) => {
      if (!cancelled && thumb) setResolved(thumb);
    });

    return () => {
      cancelled = true;
    };
  }, [sourceURL, serverThumbnailURL]);

  return resolved;
}
