/**
 * Security matrix — prototype pollution resistance and rate-limiter wiring.
 */

import { describe, it, expect } from 'bun:test';
import { sanitizeObject } from '../../utils/sanitize';
import * as rateLimiters from '../../middleware/rateLimiter';
import {
  buildSecurityCatalog,
  generatePrototypePollutionPayloads,
} from '../fixtures/securityPayloads';

const catalog = buildSecurityCatalog();

describe('security.prototype — sanitizeObject contains pollution', () => {
  for (const c of catalog.proto) {
    it(`[${c.id}] proto ${c.category}`, () => {
      const out = sanitizeObject(c.payload as Record<string, unknown>);
      expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
      expect(Object.prototype.hasOwnProperty.call(out, 'isAdmin')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(out, 'constructor')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(out, 'prototype')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(out, '__proto__')).toBe(false);
      const json = JSON.stringify(out);
      expect(json).not.toMatch(/<script/i);
    });
  }
});

describe('security.prototype — mega pollution grid', () => {
  const mega = generatePrototypePollutionPayloads(400);
  for (const c of mega) {
    it(`[${c.id}] mega proto`, () => {
      sanitizeObject(c.payload);
      expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
      expect(({} as { isAdmin?: boolean }).isAdmin).toBeUndefined();
    });
  }
});

describe('security.prototype — deep nesting depth cap', () => {
  function nest(depth: number): Record<string, unknown> {
    if (depth <= 0) return { leaf: '<script>x</script>' };
    return { child: nest(depth - 1) };
  }
  for (let depth = 1; depth <= 25; depth++) {
    it(`depth ${depth}`, () => {
      const out = sanitizeObject(nest(depth), { maxDepth: 10 });
      expect(JSON.stringify(out)).not.toMatch(/<script/i);
    });
  }
});

describe('security.rate-limit — limiters are configured middleware', () => {
  const names = [
    'globalIpLimiter',
    'userLimiter',
    'authLimiter',
    'signInLimiter',
    'signUpLimiter',
    'refreshLimiter',
    'passwordResetRequestLimiter',
    'passwordResetConfirmLimiter',
    'importLimiter',
    'uploadLimiter',
    'searchLimiter',
    'healthLimiter',
    'publicConfigLimiter',
  ] as const;

  for (const name of names) {
    it(`exports ${name}`, () => {
      expect(typeof rateLimiters[name]).toBe('function');
    });
  }
});

describe('security.rate-limit — env keys documented in template', () => {
  it('env.template lists rate limit variables', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const template = fs.readFileSync(path.join(import.meta.dir, '../../../env.template'), 'utf8');
    expect(template).toContain('RATE_LIMIT_SIGNIN_MAX');
    expect(template).toContain('RATE_LIMIT_IMPORT_MAX');
    expect(template).toContain('RATE_LIMIT_SEARCH_MAX');
  });
});

describe('security.rate-limit — sign-in limiter is exported', () => {
  it('signInLimiter is defined', () => {
    expect(rateLimiters.signInLimiter).toBeDefined();
  });
});

describe('security.env — dev password reset flag blocked in production', () => {
  it('documents production guard exists in auth route source', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const authSrc = fs.readFileSync(
      path.join(import.meta.dir, '../../routes/auth.ts'),
      'utf8',
    );
    expect(authSrc).toContain("process.env.NODE_ENV === 'production'");
    expect(authSrc).toContain('ALLOW_DEV_PASSWORD_RESET_TOKEN');
    expect(authSrc).toContain('sanitizeUserSettingsForClient');
  });
});

describe('security.public — config route must not expose server maps key', () => {
  it('index public config uses EXPO_PUBLIC only', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const indexSrc = fs.readFileSync(path.join(import.meta.dir, '../../index.ts'), 'utf8');
    expect(indexSrc).toContain('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY');
    expect(indexSrc).not.toMatch(/GOOGLE_MAPS_API_KEY \|\| process\.env\.EXPO/);
  });
});
