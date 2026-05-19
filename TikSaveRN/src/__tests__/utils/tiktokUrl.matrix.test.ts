/** Mass matrix tests for TikTok URL extraction (~500+ cases). */

import { describe, it, expect } from 'bun:test';
import { extractTikTokUrl, extractTikTokUrlFromIncomingUrl } from '../../utils/tiktokUrl';
import { generateTikTokUrlsInText, generateNonTikTokTexts } from '../fixtures/generators';

const IN_TEXT = generateTikTokUrlsInText(250);
const NON_TIKTOK = generateNonTikTokTexts(100);

describe('tiktokUrl.matrix — extractTikTokUrl', () => {
  for (let i = 0; i < IN_TEXT.length; i++) {
    const { text, expected } = IN_TEXT[i];
    it(`extracts from text ${i}`, () => {
      const found = extractTikTokUrl(text);
      expect(found).not.toBeNull();
      expect(found!.startsWith('https://')).toBe(true);
      expect(found).toContain(`/video/`);
      if (expected) expect(found).toContain(expected.split('/video/')[1]?.split('?')[0] ?? '');
    });
  }

  for (let i = 0; i < NON_TIKTOK.length; i++) {
    it(`no match ${i}`, () => {
      expect(extractTikTokUrl(NON_TIKTOK[i])).toBeNull();
    });
  }

  const vmUrls = Array.from({ length: 50 }, (_, i) => `https://vm.tiktok.com/ABC${i}/`);
  for (let i = 0; i < vmUrls.length; i++) {
    it(`vm url ${i}`, () => {
      expect(extractTikTokUrl(`share ${vmUrls[i]}`)).toBe(vmUrls[i]);
    });
  }

  const shortUrls = Array.from({ length: 30 }, (_, i) => `https://www.tiktok.com/t/ZTR${i}/`);
  for (let i = 0; i < shortUrls.length; i++) {
    it(`short t/ url ${i}`, () => {
      expect(extractTikTokUrl(shortUrls[i])).toBe(shortUrls[i]);
    });
  }
});

describe('tiktokUrl.matrix — extractTikTokUrlFromIncomingUrl', () => {
  for (let i = 0; i < IN_TEXT.length; i++) {
    const { expected } = IN_TEXT[i];
    if (!expected) continue;
    it(`deep link url param ${i}`, () => {
      const incoming = `myapp://share?url=${encodeURIComponent(expected)}`;
      expect(extractTikTokUrlFromIncomingUrl(incoming)).toBe(expected);
    });
    it(`deep link text param ${i}`, () => {
      const incoming = `myapp://import?text=${encodeURIComponent(`watch ${expected}`)}`;
      expect(extractTikTokUrlFromIncomingUrl(incoming)).toBe(expected);
    });
  }

  for (let i = 0; i < 40; i++) {
    it(`direct in incoming ${i}`, () => {
      const url = `https://www.tiktok.com/@u${i}/video/${i}`;
      expect(extractTikTokUrlFromIncomingUrl(url)).toBe(url);
    });
  }

  for (let i = 0; i < 30; i++) {
    it(`invalid incoming ${i}`, () => {
      expect(extractTikTokUrlFromIncomingUrl('not-a-url')).toBeNull();
      expect(extractTikTokUrlFromIncomingUrl('')).toBeNull();
    });
  }
});
