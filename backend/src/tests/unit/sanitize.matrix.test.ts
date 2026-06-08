/** Mass matrix tests for sanitize utilities (~800+ cases). */

import { describe, it, expect, beforeAll } from 'bun:test';
import {
  escapeHtml,
  stripHtml,
  sanitizeString,
  sanitizeUrl,
  sanitizeTikTokUrl,
  sanitizeTikTokImageUrl,
  sanitizeUserContent,
  sanitizeEmail,
  sanitizeUsername,
  removeNullBytes,
  sanitizeObject,
} from '../../utils/sanitize';
import {
  generateTikTokVideoUrls,
  generateVmTikTokUrls,
  generateInvalidUrls,
  generateHtmlInjectionStrings,
} from '../fixtures/generators';

const VALID_TIKTOK = generateTikTokVideoUrls(200);
const VALID_VM = generateVmTikTokUrls(80);
const INVALID_URLS = generateInvalidUrls(150);
const HTML_PAYLOADS = generateHtmlInjectionStrings(120);

describe('sanitize.matrix — escapeHtml', () => {
  const chars = ['&', '<', '>', '"', "'", '/', '`', '='];
  for (const ch of chars) {
    it(`escapes ${ch}`, () => {
      const out = escapeHtml(`a${ch}b`);
      if (ch === '&') expect(out).toBe('a&amp;b');
      else expect(out).not.toContain(ch);
    });
  }
  for (let i = 0; i < 50; i++) {
    it(`roundtrip-safe string #${i}`, () => {
      const s = `plain ${i} text`;
      expect(escapeHtml(s)).toBe(s);
    });
  }
});

describe('sanitize.matrix — stripHtml', () => {
  for (let i = 0; i < HTML_PAYLOADS.length; i++) {
    const payload = HTML_PAYLOADS[i];
    it(`strips tags case ${i}`, () => {
      const out = stripHtml(payload);
      expect(out).not.toMatch(/<script/i);
      expect(out).not.toMatch(/<[^>]+>/);
    });
  }
});

describe('sanitize.matrix — sanitizeString', () => {
  for (let i = 0; i < HTML_PAYLOADS.length; i++) {
    it(`sanitizes html payload ${i}`, () => {
      const out = sanitizeString(HTML_PAYLOADS[i], { maxLength: 500 });
      expect(out).not.toMatch(/<script/i);
    });
  }
  for (let i = 0; i < 60; i++) {
    it(`maxLength truncates ${i}`, () => {
      const out = sanitizeString('a'.repeat(100), { maxLength: 10 + (i % 20) });
      expect(out.length).toBeLessThanOrEqual(10 + (i % 20));
    });
  }
  for (let i = 0; i < 40; i++) {
    it(`allowNewlines false ${i}`, () => {
      const out = sanitizeString(`line1\nline2\t tab ${i}`, { allowNewlines: false });
      expect(out).not.toContain('\n');
    });
  }
});

describe('sanitize.matrix — sanitizeUrl', () => {
  for (let i = 0; i < VALID_TIKTOK.length; i++) {
    it(`accepts https tiktok ${i}`, () => {
      expect(sanitizeUrl(VALID_TIKTOK[i])).toBeTruthy();
    });
  }
  const urlMustReject = (u: string) =>
    u.startsWith('javascript:') ||
    u.startsWith('file:') ||
    u.startsWith('ftp:') ||
    u.includes('127.0.0.1') ||
    u.includes('localhost') ||
    u.includes('10.0.0.1') ||
    u.includes('192.168.') ||
    u.includes('169.254.') ||
    u.trim() === '' ||
    u === 'not-a-url' ||
    u === '   ';
  for (let i = 0; i < INVALID_URLS.length; i++) {
    it(`sanitizeUrl policy ${i}`, () => {
      const url = INVALID_URLS[i];
      const result = sanitizeUrl(url);
      if (urlMustReject(url)) {
        expect(result).toBeNull();
      } else if (url.startsWith('http')) {
        expect(result).not.toBeNull();
      }
    });
  }
});

describe('sanitize.matrix — sanitizeTikTokUrl', () => {
  for (let i = 0; i < VALID_TIKTOK.length; i++) {
    it(`allows video url ${i}`, () => {
      expect(sanitizeTikTokUrl(VALID_TIKTOK[i])).not.toBeNull();
    });
  }
  for (let i = 0; i < VALID_VM.length; i++) {
    it(`allows vm url ${i}`, () => {
      expect(sanitizeTikTokUrl(VALID_VM[i])).not.toBeNull();
    });
  }
  for (let i = 0; i < INVALID_URLS.length; i++) {
    it(`blocks invalid ${i}`, () => {
      expect(sanitizeTikTokUrl(INVALID_URLS[i])).toBeNull();
    });
  }
});

describe('sanitize.matrix — sanitizeTikTokImageUrl', () => {
  const cdnHosts = [
    'https://p16-sign.tiktokcdn-us.com/obj/test.jpg',
    'https://p77-sign.tiktokcdn.com/obj/test~tplv.jpeg',
    'https://sf16-ies-music-va.tiktokcdn.com/obj/cover.jpg',
  ];
  for (let i = 0; i < 100; i++) {
    const base = cdnHosts[i % cdnHosts.length];
    it(`cdn allow ${i}`, () => {
      expect(sanitizeTikTokImageUrl(`${base}?v=${i}`)).not.toBeNull();
    });
  }
  for (let i = 0; i < 50; i++) {
    it(`rejects random host ${i}`, () => {
      expect(sanitizeTikTokImageUrl(`https://example-${i}.com/img.jpg`)).toBeNull();
    });
  }
});

describe('sanitize.matrix — sanitizeUserContent', () => {
  for (let i = 0; i < HTML_PAYLOADS.length; i++) {
    it(`user content ${i}`, () => {
      const out = sanitizeUserContent(HTML_PAYLOADS[i]);
      expect(out.toLowerCase()).not.toContain('<script');
    });
  }
});

describe('sanitize.matrix — sanitizeEmail', () => {
  const valid = ['User@Example.COM', 'a@b.co'];
  const invalid = ['', 'not-email', '@nodomain'];
  for (let i = 0; i < valid.length; i++) {
    for (let j = 0; j < 20; j++) {
      it(`valid email ${i}-${j}`, () => {
        expect(sanitizeEmail(valid[i])).toBe(valid[i].toLowerCase());
      });
    }
  }
  for (let i = 0; i < invalid.length; i++) {
    for (let j = 0; j < 20; j++) {
      it(`invalid email ${i}-${j}`, () => {
        expect(sanitizeEmail(invalid[i])).toBeNull();
      });
    }
  }
});

describe('sanitize.matrix — sanitizeUsername', () => {
  const samples = ['user_name', 'user.name', 'bad@name!', 'a'.repeat(100), ''];
  for (let i = 0; i < 80; i++) {
    const s = samples[i % samples.length];
    it(`username ${i}`, () => {
      expect(sanitizeUsername(s).length).toBeLessThanOrEqual(50);
      expect(sanitizeUsername(s)).toMatch(/^[\w.-]*$/);
    });
  }
});

describe('sanitize.matrix — removeNullBytes', () => {
  for (let i = 0; i < 30; i++) {
    it(`null bytes ${i}`, () => {
      expect(removeNullBytes(`a\0b${i}`)).toBe(`ab${i}`);
    });
  }
});

describe('sanitize.matrix — sanitizeObject', () => {
  for (let i = 0; i < 40; i++) {
    it(`nested object ${i}`, () => {
      const out = sanitizeObject({
        title: `<b>${i}</b>`,
        nested: { note: `onload=${i}` },
        arr: [`<i>${i}</i>`],
      });
      expect(JSON.stringify(out)).not.toContain('<b>');
    });
  }
});
