/**
 * Real-world TikTok share payloads (iOS, Android, in-app copy variants).
 */

import { describe, it, expect } from 'bun:test';
import { extractTikTokUrl, extractTikTokUrlFromIncomingUrl } from '../../utils/tiktokUrl';

describe('TikTok share payload scenarios', () => {
  const standardVideo = 'https://www.tiktok.com/@chefmaria/video/7234567890123456789';

  it('iOS share sheet wraps URL in marketing text', () => {
    const text = `Check out this video! ${standardVideo} #fyp`;
    expect(extractTikTokUrl(text)).toContain('/video/');
  });

  it('Android intent uses tiktok:// deep link with url query', () => {
    const incoming = `tiksave://import?url=${encodeURIComponent(standardVideo)}`;
    expect(extractTikTokUrlFromIncomingUrl(incoming)).toBe(standardVideo);
  });

  it('double-encoded query param from Samsung share', () => {
    const once = encodeURIComponent(standardVideo);
    const twice = encodeURIComponent(once);
    const incoming = `tiksave://share?text=${twice}`;
    expect(extractTikTokUrlFromIncomingUrl(incoming)).toBe(standardVideo);
  });

  it('vm.tiktok short link in SMS preview', () => {
    const short = 'https://vm.tiktok.com/ZMTestShort/';
    expect(extractTikTokUrl(`Sent you: ${short}`)).toBe(short);
  });

  it('tiktok.com/t/ short link variant', () => {
    const tLink = 'https://www.tiktok.com/t/ZTRabc123/';
    expect(extractTikTokUrl(tLink)).toBe(tLink);
  });

  it('rejects YouTube link pasted by mistake', () => {
    expect(extractTikTokUrl('https://www.youtube.com/shorts/abc')).toBeNull();
  });

  it('rejects bare tiktok.com without video path', () => {
    expect(extractTikTokUrl('https://www.tiktok.com/@useronly')).toBeNull();
  });

  it('handles Instagram-style wrapper with no url param', () => {
    expect(extractTikTokUrlFromIncomingUrl('myapp://open?ref=home')).toBeNull();
  });

  it('extracts from multilingual prefix (Japanese share template)', () => {
    const text = `おすすめ動画 ${standardVideo}`;
    expect(extractTikTokUrl(text)).toContain('chefmaria');
  });

  it('URL with tracking query still matches', () => {
    const tracked = `${standardVideo}?is_from_webapp=1&sender_device=pc`;
    expect(extractTikTokUrl(tracked)).toBe(tracked);
  });
});
