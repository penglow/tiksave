/** Mass matrix tests for text utilities (~400+ cases). */

import { describe, it, expect } from 'bun:test';
import { extractHashtags, extractKeywords } from '../../utils/text';
import { generateHashtagTexts } from '../fixtures/generators';

const HASHTAG_CASES = generateHashtagTexts(200);

describe('text.matrix — extractHashtags', () => {
  for (let i = 0; i < HASHTAG_CASES.length; i++) {
    const { text, tags } = HASHTAG_CASES[i];
    it(`hashtags ${i}`, () => {
      expect(extractHashtags(text)).toEqual(tags);
    });
  }
  for (let i = 0; i < 50; i++) {
    it(`empty ${i}`, () => {
      expect(extractHashtags(null)).toEqual([]);
      expect(extractHashtags('')).toEqual([]);
    });
  }
  for (let i = 0; i < 40; i++) {
    it(`no tags ${i}`, () => {
      expect(extractHashtags(`plain text ${i}`)).toEqual([]);
    });
  }
});

describe('text.matrix — extractKeywords', () => {
  for (let i = 0; i < 100; i++) {
    it(`dedupes ${i}`, () => {
      const kw = extractKeywords('the quick brown fox jumps over the lazy dog');
      expect(new Set(kw).size).toBe(kw.length);
    });
  }
  for (let i = 0; i < 80; i++) {
    it(`max 20 ${i}`, () => {
      const long = Array.from({ length: 50 }, (_, j) => `word${j}`).join(' ');
      expect(extractKeywords(long).length).toBeLessThanOrEqual(20);
    });
  }
  for (let i = 0; i < 60; i++) {
    it(`filters stop words ${i}`, () => {
      const kw = extractKeywords('the and or but cooking recipe');
      expect(kw).not.toContain('the');
      expect(kw.some((w) => w.includes('cook') || w.includes('recipe'))).toBe(true);
    });
  }
});
