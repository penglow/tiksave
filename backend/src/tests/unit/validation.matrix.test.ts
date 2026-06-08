/** Mass matrix tests for Zod CommonSchemas (~350+ cases). */

import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import { CommonSchemas, parseOrThrow } from '../../middleware/validation';

const UUID_SAMPLES = [
  '00000000-0000-4000-8000-000000000000',
  'ffffffff-ffff-4fff-bfff-ffffffffffff',
  'not-uuid',
  '',
  '00000000-0000-4000-8000',
];

describe('validation.matrix — uuid', () => {
  for (let i = 0; i < UUID_SAMPLES.length; i++) {
    const s = UUID_SAMPLES[i];
    it(`uuid sample ${i}`, () => {
      const r = CommonSchemas.uuid.safeParse(s);
      if (i < 2) expect(r.success).toBe(true);
      else expect(r.success).toBe(false);
    });
  }
  for (let i = 0; i < 40; i++) {
    it(`uuid v4 generated ${i}`, () => {
      const id = crypto.randomUUID();
      expect(CommonSchemas.uuid.safeParse(id).success).toBe(true);
    });
  }
});

describe('validation.matrix — pagination', () => {
  for (let i = -20; i < 120; i++) {
    it(`pagination limit ${i}`, () => {
      const r = CommonSchemas.pagination.safeParse({ limit: String(i), offset: '0' });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.limit).toBeGreaterThanOrEqual(1);
        expect(r.data.limit).toBeLessThanOrEqual(100);
      }
    });
  }
});

describe('validation.matrix — email', () => {
  const validEmails = ['user@example.com', 'a.b+c@sub.domain.co', 'team@tiksave.app'];
  const invalidEmails = ['', 'bad', '@.', 'a@', '@b.com', 'a b@c.com'];
  for (let i = 0; i < validEmails.length; i++) {
    for (let j = 0; j < 10; j++) {
      it(`valid email ${i}-${j}`, () => {
        expect(CommonSchemas.email.safeParse(validEmails[i]).success).toBe(true);
      });
    }
  }
  for (let i = 0; i < invalidEmails.length; i++) {
    for (let j = 0; j < 10; j++) {
      it(`invalid email ${i}-${j}`, () => {
        expect(CommonSchemas.email.safeParse(invalidEmails[i]).success).toBe(false);
      });
    }
  }
});

describe('validation.matrix — password', () => {
  for (let len = 0; len < 20; len++) {
    it(`password length ${len}`, () => {
      const p = 'a'.repeat(len);
      const r = CommonSchemas.password.safeParse(p);
      expect(r.success).toBe(len >= 8);
    });
  }
});

describe('validation.matrix — colorHex', () => {
  const colors = ['#000000', '#FFFFFF', '#abc123', 'red', '#fff', '#12345g'];
  for (let i = 0; i < colors.length; i++) {
    it(`color ${i}`, () => {
      const r = CommonSchemas.colorHex.safeParse(colors[i]);
      expect(r.success).toBe(i < 3);
    });
  }
  for (let i = 0; i < 50; i++) {
    const hex = `#${(i * 999999 % 0xffffff).toString(16).padStart(6, '0')}`;
    it(`generated hex ${i}`, () => {
      expect(CommonSchemas.colorHex.safeParse(hex).success).toBe(true);
    });
  }
});

describe('validation.matrix — parseOrThrow', () => {
  const schema = z.object({ n: z.number() });
  for (let i = 0; i < 30; i++) {
    it(`throws on bad ${i}`, () => {
      expect(() => parseOrThrow(schema, { n: 'x' })).toThrow();
    });
    it(`returns data ${i}`, () => {
      expect(parseOrThrow(schema, { n: i })).toEqual({ n: i });
    });
  }
});
