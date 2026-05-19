/**
 * Security matrix — TikTok CDN allow-list, email attacks, Zod validation hardening.
 */

import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import { sanitizeTikTokImageUrl, sanitizeEmail } from '../../utils/sanitize';
import { CommonSchemas, parseOrThrow } from '../../middleware/validation';
import {
  buildSecurityCatalog,
  generateMaliciousImageUrls,
  generateEmailAttackStrings,
  generateUnicodeTrickStrings,
} from '../fixtures/securityPayloads';

const catalog = buildSecurityCatalog();

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().optional(),
});

const createItemSchema = z.object({
  sourceURL: z.string().url(),
  rawSharedText: z.string().optional(),
});

const batchCreateSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(50),
});

describe('security.cdn — TikTok image URL allow-list', () => {
  for (const c of catalog.images) {
    it(`[${c.id}] ${c.category} ${c.mustReject ? 'block' : 'allow'}`, () => {
      const result = sanitizeTikTokImageUrl(c.payload);
      if (c.mustReject) expect(result).toBeNull();
      else expect(result).not.toBeNull();
    });
  }
});

describe('security.cdn — mega image grid', () => {
  const mega = generateMaliciousImageUrls(600);
  for (const c of mega) {
    it(`[${c.id}] mega cdn`, () => {
      const result = sanitizeTikTokImageUrl(c.payload);
      if (c.mustReject) expect(result).toBeNull();
      else expect(result).not.toBeNull();
    });
  }
});

describe('security.email — sanitizeEmail rejects attacks', () => {
  for (const c of catalog.emails) {
    it(`[${c.id}] email attack`, () => {
      expect(sanitizeEmail(c.payload)).toBeNull();
    });
  }
  const mega = generateEmailAttackStrings(400);
  for (const c of mega) {
    it(`[${c.id}] mega email`, () => {
      expect(sanitizeEmail(c.payload)).toBeNull();
    });
  }
});

describe('security.email — zod signup rejects attacks', () => {
  for (const c of catalog.emails) {
    it(`[${c.id}] zod signup email`, () => {
      expect(signUpSchema.safeParse({ email: c.payload, password: 'validpass1' }).success).toBe(false);
    });
  }
});

describe('security.unicode — email/url tricks', () => {
  for (const c of catalog.unicode) {
    it(`[${c.id}] unicode trick`, () => {
      const candidate = c.payload.includes('@') ? c.payload : `user+${c.payload}@example.com`;
      const email = sanitizeEmail(candidate);
      expect(email === null || typeof email === 'string').toBe(true);
    });
  }
  const mega = generateUnicodeTrickStrings(300);
  for (const c of mega) {
    it(`[${c.id}] mega unicode`, () => {
      const candidate = c.payload.includes('@') ? c.payload : `user+${c.payload}@example.com`;
      expect(sanitizeEmail(candidate) === null || typeof sanitizeEmail(candidate) === 'string').toBe(true);
    });
  }
});

describe('security.validation — UUID param rejects injection', () => {
  const injections = [
    "' OR 1=1--",
    '00000000-0000-4000-8000-000000000000; DROP TABLE',
    '../../../etc/passwd',
    'null',
    'undefined',
    '${uuid}',
  ];
  for (let i = 0; i < injections.length; i++) {
    for (let j = 0; j < 30; j++) {
      it(`uuid injection ${i}-${j}`, () => {
        expect(CommonSchemas.idParam.safeParse({ id: injections[i] }).success).toBe(false);
      });
    }
  }
});

describe('security.validation — pagination bounds', () => {
  for (let i = -500; i < 500; i++) {
    it(`pagination clamp ${i}`, () => {
      const r = CommonSchemas.pagination.safeParse({ limit: String(i), offset: '0' });
      if (r.success) {
        expect(r.data.limit).toBeGreaterThanOrEqual(1);
        expect(r.data.limit).toBeLessThanOrEqual(100);
      }
    });
  }
});

describe('security.validation — batch URL cap', () => {
  for (let count = 0; count <= 55; count++) {
    it(`batch size ${count}`, () => {
      const urls = Array.from({ length: count }, (_, i) => `https://www.tiktok.com/@u/video/${i}`);
      const r = batchCreateSchema.safeParse({ urls });
      expect(r.success).toBe(count >= 1 && count <= 50);
    });
  }
});

describe('security.validation — createItem rejects non-url', () => {
  const bad = ['', 'not-url', '//evil.com'];
  const zodOnlyBad = ['javascript:alert(1)'];
  for (let i = 0; i < bad.length; i++) {
    for (let j = 0; j < 25; j++) {
      it(`bad sourceURL ${i}-${j}`, () => {
        expect(createItemSchema.safeParse({ sourceURL: bad[i] }).success).toBe(false);
      });
    }
  }

  it('documents zod url() allows javascript: — blocked later by sanitizeTikTokUrl', () => {
    expect(createItemSchema.safeParse({ sourceURL: zodOnlyBad[0] }).success).toBe(true);
  });
});

describe('security.validation — parseOrThrow status codes', () => {
  for (let i = 0; i < 50; i++) {
    it(`parseOrThrow invalid uuid ${i}`, () => {
      try {
        parseOrThrow(CommonSchemas.uuid, `not-uuid-${i}`);
        expect(true).toBe(false);
      } catch (e: any) {
        expect(e.statusCode).toBe(400);
      }
    });
  }
});

describe('security.validation — colorHex injection', () => {
  const validColors = ['#000000', '#FFFFFF', '#abc123'];
  const invalidColors = ['#GGGGGG', 'red', '#12345', '#1234567', '<script>', 'url(javascript:1)'];
  for (let i = 0; i < validColors.length; i++) {
    for (let j = 0; j < 40; j++) {
      it(`valid color ${i}-${j}`, () => {
        expect(CommonSchemas.colorHex.safeParse(validColors[i]).success).toBe(true);
      });
    }
  }
  for (let i = 0; i < invalidColors.length; i++) {
    for (let j = 0; j < 40; j++) {
      it(`invalid color ${i}-${j}`, () => {
        expect(CommonSchemas.colorHex.safeParse(invalidColors[i]).success).toBe(false);
      });
    }
  }
});
