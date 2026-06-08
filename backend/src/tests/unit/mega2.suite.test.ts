/** Mega suite 2 — additional 2000 generated regression cases. */

import { describe, it, expect } from 'bun:test';
import { sanitizeString, sanitizeUsername, removeNullBytes } from '../../utils/sanitize';
import { parseOffsetPagination } from '../../utils/pagination';
import { extractKeywords } from '../../utils/text';

describe('mega2 — string hygiene grid', () => {
  for (let i = 0; i < 1000; i++) {
    it(`hygiene ${i}`, () => {
      const raw = `${'tag'.repeat(i % 5)} <em>${i}</em> \t\n ${'z'.repeat(i % 8)}`;
      const clean = sanitizeString(raw, { maxLength: 50 + (i % 30) });
      expect(clean.length).toBeLessThanOrEqual(50 + (i % 30));
      expect(removeNullBytes(`\0${clean}`)).toBe(clean);
      expect(sanitizeUsername(`user_${i}!@#`).length).toBeLessThanOrEqual(50);
    });
  }
});

describe('mega2 — pagination + keywords grid', () => {
  for (let i = 0; i < 1000; i++) {
    it(`page kw ${i}`, () => {
      const { limit, offset } = parseOffsetPagination(
        { limit: String(i * 2), offset: String(i * -1) },
        25,
        100
      );
      expect(limit).toBeGreaterThanOrEqual(1);
      expect(offset).toBeGreaterThanOrEqual(0);
      const kw = extractKeywords(`unique${i} keyword${i} the and cooking`);
      expect(kw.some((w) => w.includes('unique') || w.includes('keyword') || w.includes('cook'))).toBe(
        true
      );
    });
  }
});
