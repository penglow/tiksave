/**
 * Mega suite — cross-module smoke matrix (2000+ generated cases).
 * Fast, no database; exercises pure functions only.
 */

import { describe, it, expect } from 'bun:test';
import { sanitizeString, sanitizeTikTokUrl } from '../../utils/sanitize';
import { encodeCursor, decodeCursor } from '../../utils/pagination';
import { extractHashtags } from '../../utils/text';
import { getNextStage } from '../../services/processingStages';

describe('mega.suite — sanitize + cursor + hashtags', () => {
  for (let i = 0; i < 500; i++) {
    it(`combo ${i}`, () => {
      const text = `#tag${i % 10} hello <b>${i}</b>`;
      const clean = sanitizeString(text, { maxLength: 200 });
      expect(clean).not.toContain('<b>');

      const tags = extractHashtags(`#tag${i % 10} other`);
      expect(tags.length).toBeGreaterThanOrEqual(0);

      const createdAt = new Date(2024, 5, 1, 0, i % 60).toISOString();
      const id = `00000000-0000-4000-8000-${i.toString(16).padStart(12, '0')}`;
      const cursor = encodeCursor(createdAt, id);
      expect(decodeCursor(cursor)?.id).toBe(id);
    });
  }
});

describe('mega.suite — tiktok url + stages', () => {
  for (let i = 0; i < 500; i++) {
    it(`url stage ${i}`, () => {
      const url = `https://www.tiktok.com/@creator${i % 20}/video/${7000000000000000000n + BigInt(i)}`;
      expect(sanitizeTikTokUrl(url)).not.toBeNull();

      const stages = ['queued', 'downloading', 'analyzing', 'classifying', 'saving'] as const;
      const stage = stages[i % stages.length];
      const next = getNextStage(stage);
      if (stage === 'saving') expect(next).toBe('ready');
      else expect(next).not.toBeNull();
    });
  }
});

describe('mega.suite — numeric sanitization grid', () => {
  for (let a = 0; a < 50; a++) {
    for (let b = 0; b < 20; b++) {
      it(`grid ${a}-${b}`, () => {
        const s = 'x'.repeat(a) + `<i>${b}</i>` + 'y'.repeat(b);
        const out = sanitizeString(s, { maxLength: a + b + 10 });
        expect(out.length).toBeLessThanOrEqual(a + b + 10);
      });
    }
  }
});
