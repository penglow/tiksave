/**
 * Mega frontend suite — 1500+ generated pure-function cases.
 */

import { describe, it, expect } from 'bun:test';
import { extractTikTokUrl } from '../utils/tiktokUrl';
import { formatDuration } from '../utils/date';
import { getDisplayTitle, getConfidenceLevel } from '../types';
import { buildSaveItem } from './fixtures/generators';

describe('mega.frontend — url + title + duration', () => {
  for (let i = 0; i < 500; i++) {
    it(`row ${i}`, () => {
      const url = `https://www.tiktok.com/@u${i}/video/${7000000000000000000n + BigInt(i)}`;
      expect(extractTikTokUrl(`see ${url} now`)).toBe(url);

      const item = buildSaveItem({ title: `T${i}`, confidence: (i % 100) / 100 });
      expect(getDisplayTitle(item)).toBe(`T${i}`);
      expect(['high', 'medium', 'low']).toContain(getConfidenceLevel(item.confidence));

      const seconds = i * 3;
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      expect(formatDuration(seconds)).toBe(`${mins}:${secs.toString().padStart(2, '0')}`);
    });
  }
});

describe('mega.frontend — duration grid', () => {
  for (let m = 0; m < 30; m++) {
    for (let s = 0; s < 60; s++) {
      it(`dur ${m}:${s}`, () => {
        const total = m * 60 + s;
        expect(formatDuration(total)).toBe(`${m}:${s.toString().padStart(2, '0')}`);
      });
    }
  }
});

describe('mega.frontend — title variants', () => {
  for (let i = 0; i < 400; i++) {
    it(`transcript ${i}`, () => {
      const item = buildSaveItem({
        title: undefined,
        transcriptText: i % 2 === 0 ? `word `.repeat(5) : '',
      });
      const t = getDisplayTitle(item);
      expect(typeof t).toBe('string');
      expect(t.length).toBeGreaterThan(0);
    });
  }
});
