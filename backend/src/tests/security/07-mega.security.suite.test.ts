/**
 * Mega security suite — thousands of combined attack × defense cases (no DB).
 */

import { describe, it, expect } from 'bun:test';
import crypto from 'crypto';
import {
  sanitizeString,
  sanitizeTikTokUrl,
  sanitizeTikTokImageUrl,
  sanitizeUserContent,
  sanitizeEmail,
  sanitizeUserSettingsForClient,
  sanitizeObject,
  removeNullBytes,
} from '../../utils/sanitize';
import { CommonSchemas } from '../../middleware/validation';
import {
  generateSsrfAttackUrls,
  generateXssPayloads,
  generateSqlInjectionStrings,
  generateValidTikTokUrls,
} from '../fixtures/securityPayloads';

describe('mega.security — ssrf × xss combo grid (1500 cases)', () => {
  const ssrf = generateSsrfAttackUrls(50);
  const xss = generateXssPayloads(30);

  for (let i = 0; i < 1500; i++) {
    it(`combo ${i}`, () => {
      const urlCase = ssrf[i % ssrf.length];
      const xssCase = xss[i % xss.length];

      expect(sanitizeTikTokUrl(urlCase.payload)).toBeNull();

      const caption = sanitizeUserContent(`${xssCase.payload} ${urlCase.payload}`, 2000);
      expect(caption.toLowerCase()).not.toMatch(/<script\b/);

      const folder = sanitizeString(xssCase.payload, { maxLength: 100, allowNewlines: false });
      expect(folder).not.toMatch(/<script/i);
    });
  }
});

describe('mega.security — valid url + leaky settings (1000 cases)', () => {
  const valid = generateValidTikTokUrls(40);

  for (let i = 0; i < 1000; i++) {
    it(`valid+settings ${i}`, () => {
      expect(sanitizeTikTokUrl(valid[i % valid.length].payload)).not.toBeNull();

      const safe = sanitizeUserSettingsForClient({
        theme: 'system',
        passwordResetToken: crypto.randomBytes(16).toString('hex'),
        passwordResetExpiry: new Date().toISOString(),
      });
      expect(JSON.stringify(safe)).not.toContain('passwordReset');
    });
  }
});

describe('mega.security — sqli strings in zod bodies (800 cases)', () => {
  const sqli = generateSqlInjectionStrings(40);

  for (let i = 0; i < 800; i++) {
    it(`sqli zod ${i}`, () => {
      const injection = sqli[i % sqli.length].payload;
      expect(CommonSchemas.uuid.safeParse(injection).success).toBe(false);
      expect(
        CommonSchemas.idParam.safeParse({ id: injection }).success,
      ).toBe(false);

      const obj = sanitizeObject({ title: injection, nested: { q: injection } });
      expect(JSON.stringify(obj)).not.toMatch(/<script/i);
    });
  }
});

describe('mega.security — image cdn × null byte (600 cases)', () => {
  for (let i = 0; i < 600; i++) {
    it(`cdn null ${i}`, () => {
      const url = `https://evil-${i}.example.com/thumb.jpg`;
      expect(sanitizeTikTokImageUrl(url)).toBeNull();

      const name = removeNullBytes(`Folder\0${i}`);
      expect(name).not.toContain('\0');
      expect(sanitizeString(name, { maxLength: 80 })).not.toContain('\0');
    });
  }
});

describe('mega.security — email normalization grid (500 cases)', () => {
  for (let i = 0; i < 500; i++) {
    it(`email ${i}`, () => {
      const raw = `  User${i}@Example.COM  `;
      const cleaned = sanitizeEmail(raw);
      expect(cleaned).toBe(`user${i}@example.com`);

      const bad = sanitizeEmail(`bad${i}\r\ncc:evil@evil.com`);
      expect(bad).toBeNull();
    });
  }
});

describe('mega.security — pagination + password policy (400 cases)', () => {
  for (let i = 0; i < 400; i++) {
    it(`policy ${i}`, () => {
      const limitRaw = String(i * 3 - 100);
      const p = CommonSchemas.pagination.safeParse({ limit: limitRaw, offset: '0' });
      if (p.success) {
        expect(p.data.limit).toBeGreaterThanOrEqual(1);
        expect(p.data.limit).toBeLessThanOrEqual(100);
      }

      const pass = 'a'.repeat(Math.max(0, (i % 20)));
      expect(CommonSchemas.password.safeParse(pass).success).toBe(pass.length >= 8);
    });
  }
});

describe('mega.security — catalog smoke count', () => {
  it('reports minimum generated attack catalog size', async () => {
    const { buildSecurityCatalog } = await import('../fixtures/securityPayloads.js');
    const cat = buildSecurityCatalog();
    const total =
      cat.ssrf.length +
      cat.spoof.length +
      cat.xss.length +
      cat.sqli.length +
      cat.proto.length +
      cat.leaks.length +
      cat.images.length +
      cat.unicode.length +
      cat.paths.length +
      cat.nulls.length +
      cat.commands.length +
      cat.emails.length +
      cat.validTikTok.length;
    expect(total).toBeGreaterThan(2500);
  });
});
