/** Mega suite 2 — 2000 additional frontend pure-function cases. */

import { describe, it, expect } from 'bun:test';
import { formatTimeAgo, formatDuration } from '../utils/date';
import { needsUserReview, isLoadingStatus } from '../types';
import { buildSaveItem } from './fixtures/generators';

describe('mega2 — status + time grid', () => {
  for (let i = 0; i < 2000; i++) {
    it(`row ${i}`, () => {
      const item = buildSaveItem({
        status: i % 2 === 0 ? 'ready' : 'processing',
        confidence: (i % 100) / 100,
      });
      expect(isLoadingStatus(item.status)).toBe(item.status === 'processing');
      expect(needsUserReview(item, 0.6)).toBe(
        item.status === 'needs_review' || (item.confidence ?? 0) < 0.6
      );

      const ago = formatTimeAgo(new Date(Date.now() - i * 60_000).toISOString());
      expect(ago.length).toBeGreaterThan(0);

      expect(formatDuration(i)).toMatch(/^\d+:\d{2}$/);
    });
  }
});
