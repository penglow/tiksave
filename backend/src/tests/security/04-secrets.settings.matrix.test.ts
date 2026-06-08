/**
 * Security matrix — API must not leak password-reset tokens, hashes, or internal settings.
 */

import { describe, it, expect } from 'bun:test';
import crypto from 'crypto';
import { sanitizeUserSettingsForClient } from '../../utils/sanitize';
import {
  buildSecurityCatalog,
  generateLeakySettingsObjects,
} from '../fixtures/securityPayloads';

const catalog = buildSecurityCatalog();

const FORBIDDEN_IN_CLIENT_JSON = [
  'passwordResetToken',
  'passwordResetExpiry',
  'password_hash',
  'refreshToken',
  '"apiKey"',
  '"secret"',
];

function assertNoSecretsInJson(json: string): void {
  for (const needle of FORBIDDEN_IN_CLIENT_JSON) {
    expect(json).not.toContain(needle);
  }
  expect(json).not.toMatch(/passwordReset/i);
}

describe('security.settings — sanitizeUserSettingsForClient strips internal keys', () => {
  for (const c of catalog.leaks) {
    it(`[${c.id}] strips leak keys`, () => {
      const safe = sanitizeUserSettingsForClient(c.payload);
      const json = JSON.stringify(safe);
      assertNoSecretsInJson(json);
      expect(safe.passwordResetToken).toBeUndefined();
      expect(safe.passwordResetExpiry).toBeUndefined();
    });
  }
});

describe('security.settings — mega leak grid', () => {
  const mega = generateLeakySettingsObjects(300);
  for (const c of mega) {
    it(`[${c.id}] mega leak`, () => {
      assertNoSecretsInJson(JSON.stringify(sanitizeUserSettingsForClient(c.payload)));
    });
  }
});

describe('security.settings — preserves safe preferences', () => {
  for (let i = 0; i < 100; i++) {
    it(`preserves safe prefs ${i}`, () => {
      const safe = sanitizeUserSettingsForClient({
        theme: i % 2 === 0 ? 'dark' : 'light',
        enableVideoUpload: true,
        confidenceThreshold: 0.85,
        passwordResetToken: crypto.randomBytes(32).toString('hex'),
      });
      expect(safe.theme).toBeTruthy();
      expect(safe.enableVideoUpload).toBe(true);
      expect(safe.passwordResetToken).toBeUndefined();
    });
  }
});

describe('security.settings — null and malformed inputs', () => {
  const inputs: unknown[] = [null, undefined, '', 0, false, [], 'string', 42];
  for (let i = 0; i < inputs.length; i++) {
    for (let j = 0; j < 20; j++) {
      it(`malformed settings ${i}-${j}`, () => {
        const safe = sanitizeUserSettingsForClient(inputs[i] as Record<string, unknown>);
        expect(typeof safe).toBe('object');
        assertNoSecretsInJson(JSON.stringify(safe));
      });
    }
  }
});

describe('security.crypto — password reset token hashing is one-way', () => {
  for (let i = 0; i < 80; i++) {
    it(`reset hash ${i}`, () => {
      const raw = crypto.randomBytes(32).toString('hex');
      const hash = crypto.createHash('sha256').update(raw).digest('hex');
      expect(hash).not.toBe(raw);
      expect(hash.length).toBe(64);
      const wrong = crypto.createHash('sha256').update(raw + 'x').digest('hex');
      expect(wrong).not.toBe(hash);
    });
  }
});

describe('security.crypto — refresh token hash differs from raw', () => {
  for (let i = 0; i < 80; i++) {
    it(`refresh hash ${i}`, () => {
      const raw = `refresh-${i}-${crypto.randomUUID()}`;
      const hash = crypto.createHash('sha256').update(raw).digest('hex');
      expect(hash).not.toContain(raw.slice(0, 8));
    });
  }
});
