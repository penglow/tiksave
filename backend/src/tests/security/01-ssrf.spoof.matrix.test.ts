/**
 * Security matrix — SSRF, domain spoofing, and valid TikTok URL allow-list.
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import { sanitizeTikTokUrl, sanitizeUrl } from '../../utils/sanitize';
import {
  buildSecurityCatalog,
  generateSsrfAttackUrls,
  generateTikTokSpoofUrls,
  generateValidTikTokUrls,
} from '../fixtures/securityPayloads';

const catalog = buildSecurityCatalog();

describe('security.ssrf — private and metadata targets must be blocked', () => {
  for (const c of catalog.ssrf) {
    it(`[${c.id}] ${c.category} rejects ${c.payload.slice(0, 60)}`, () => {
      expect(sanitizeTikTokUrl(c.payload)).toBeNull();
      expect(sanitizeUrl(c.payload)).toBeNull();
    });
  }
});

describe('security.spoof — lookalike TikTok domains must be blocked', () => {
  for (const c of catalog.spoof) {
    it(`[${c.id}] blocks spoof ${c.payload.slice(0, 70)}`, () => {
      expect(sanitizeTikTokUrl(c.payload)).toBeNull();
    });
  }
});

describe('security.ssrf — extra generated SSRF grid', () => {
  const extra = generateSsrfAttackUrls(400);
  for (const c of extra) {
    it(`[${c.id}] extra ssrf`, () => {
      expect(sanitizeTikTokUrl(c.payload)).toBeNull();
    });
  }
});

describe('security.spoof — extra spoof grid', () => {
  const extra = generateTikTokSpoofUrls(300);
  for (const c of extra) {
    it(`[${c.id}] extra spoof`, () => {
      expect(sanitizeTikTokUrl(c.payload)).toBeNull();
    });
  }
});

describe('security.valid-tiktok — legitimate hosts must pass', () => {
  for (const c of catalog.validTikTok) {
    it(`[${c.id}] allows ${c.payload.slice(0, 80)}`, () => {
      expect(sanitizeTikTokUrl(c.payload)).not.toBeNull();
    });
  }
});

describe('security.valid-tiktok — expanded allow grid', () => {
  const extra = generateValidTikTokUrls(500);
  for (const c of extra) {
    it(`[${c.id}] valid grid`, () => {
      expect(sanitizeTikTokUrl(c.payload)).not.toBeNull();
    });
  }
});

describe('security.ssrf — protocol downgrade attempts', () => {
  const protocols = ['javascript:', 'data:', 'file:', 'ftp:', 'gopher:', 'vbscript:'];
  for (let i = 0; i < protocols.length; i++) {
    for (let j = 0; j < 25; j++) {
      it(`protocol ${protocols[i]} variant ${j}`, () => {
        const url = `${protocols[i]}//www.tiktok.com/@u/video/${j}`;
        expect(sanitizeTikTokUrl(url)).toBeNull();
        expect(sanitizeUrl(url)).toBeNull();
      });
    }
  }
});
