/**
 * Unique display helper cases for SaveItem UI copy.
 */

import { describe, it, expect } from 'bun:test';
import {
  getDisplayTitle,
  needsUserReview,
  getConfidenceLevel,
  CONFIDENCE_COLORS,
  STATUS_DISPLAY_NAMES,
} from '../../types';
import { buildSaveItem } from '../fixtures/generators';

describe('SaveItem display scenarios', () => {
  it('shows exact title when present even if transcript exists', () => {
    const item = buildSaveItem({
      title: 'Hidden ramen spot',
      transcriptText: 'Different spoken title entirely',
    });
    expect(getDisplayTitle(item)).toBe('Hidden ramen spot');
  });

  it('truncates transcript to ten words with ellipsis', () => {
    const words = Array.from({ length: 15 }, (_, i) => `word${i}`).join(' ');
    const item = buildSaveItem({ title: '', transcriptText: words });
    expect(getDisplayTitle(item)).toMatch(/\.\.\.$/);
    expect(getDisplayTitle(item).split(' ').length).toBeLessThanOrEqual(11);
  });

  it('does not add ellipsis for exactly ten-word transcript', () => {
    const words = Array.from({ length: 10 }, (_, i) => `w${i}`).join(' ');
    const item = buildSaveItem({ title: '', transcriptText: words });
    expect(getDisplayTitle(item)).not.toContain('...');
  });

  it('needs review when confidence exactly at threshold is not flagged', () => {
    const item = buildSaveItem({ status: 'ready', confidence: 0.6 });
    expect(needsUserReview(item, 0.6)).toBe(false);
  });

  it('needs review when confidence one below threshold', () => {
    const item = buildSaveItem({ status: 'ready', confidence: 0.599 });
    expect(needsUserReview(item, 0.6)).toBe(true);
  });

  it('undefined confidence treated as low for badge color mapping', () => {
    expect(getConfidenceLevel(undefined)).toBe('low');
    expect(CONFIDENCE_COLORS.low).toBe('#EF4444');
  });

  it('every pipeline status has human-readable label', () => {
    const statuses = Object.keys(STATUS_DISPLAY_NAMES) as Array<keyof typeof STATUS_DISPLAY_NAMES>;
    for (const s of statuses) {
      expect(STATUS_DISPLAY_NAMES[s].length).toBeGreaterThan(2);
    }
  });

  it('unicode emoji title survives getDisplayTitle', () => {
    const item = buildSaveItem({ title: '東京グルメ 🗼🍣' });
    expect(getDisplayTitle(item)).toContain('🗼');
  });
});
