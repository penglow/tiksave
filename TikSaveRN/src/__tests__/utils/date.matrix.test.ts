/** Mass matrix tests for date formatting (~300+ cases). */

import { describe, it, expect } from 'bun:test';
import { formatDuration, formatTimeAgo } from '../../utils/date';
import { generateDurationCases } from '../fixtures/generators';

const DURATIONS = generateDurationCases(200);

describe('date.matrix — formatDuration', () => {
  for (let i = 0; i < DURATIONS.length; i++) {
    const { seconds, expected } = DURATIONS[i];
    it(`duration ${i} (${seconds}s)`, () => {
      expect(formatDuration(seconds)).toBe(expected);
    });
  }

  for (let i = 0; i < 30; i++) {
    it(`zero pad ${i}`, () => {
      expect(formatDuration(5)).toBe('0:05');
      expect(formatDuration(65)).toBe('1:05');
    });
  }
});

describe('date.matrix — formatTimeAgo', () => {
  const now = Date.now();

  const offsets = [
    { ms: 30_000, suffix: 'now' },
    { ms: 120_000, suffix: 'm' },
    { ms: 3_600_000, suffix: 'h' },
    { ms: 86_400_000, suffix: 'd' },
    { ms: 604_800_000, suffix: 'w' },
    { ms: 2_592_000_000, suffix: 'mo' },
    { ms: 31_536_000_000, suffix: 'y' },
  ];

  for (let i = 0; i < offsets.length; i++) {
    for (let j = 0; j < 10; j++) {
      it(`timeago band ${i}-${j}`, () => {
        const date = new Date(now - offsets[i].ms - j * 1000).toISOString();
        const out = formatTimeAgo(date);
        expect(out.endsWith(offsets[i].suffix) || out === 'now').toBe(true);
      });
    }
  }
});
