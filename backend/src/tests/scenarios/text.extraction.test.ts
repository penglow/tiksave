/**
 * Unique hashtag/keyword extraction stories from real caption shapes.
 */

import { describe, it, expect } from 'bun:test';
import { extractHashtags, extractKeywords } from '../../utils/text';

describe('text extraction scenarios', () => {
  it('extracts multiple hashtags from TikTok caption block', () => {
    expect(
      extractHashtags('Day 3 in Osaka #travel #foodie #japantravel — must try takoyaki')
    ).toEqual(['#travel', '#foodie', '#japantravel']);
  });

  it('returns empty for hashtag-free transcript', () => {
    expect(extractHashtags('Spoken review with no tags')).toEqual([]);
  });

  it('returns each hashtag match including case variants (no dedupe)', () => {
    const tags = extractHashtags('#fyp #fyp #viral #FYP');
    expect(tags).toEqual(['#fyp', '#fyp', '#viral', '#fyp']);
  });

  it('keywords from recipe transcript omit stop words', () => {
    const kw = extractKeywords('How to make the perfect ramen broth at home');
    expect(kw).not.toContain('the');
    expect(kw.some((w) => w.includes('ramen') || w.includes('broth'))).toBe(true);
  });

  it('caps keywords at twenty for noisy OCR dump', () => {
    const blob = Array.from({ length: 80 }, (_, i) => `term${i}`).join(' ');
    expect(extractKeywords(blob).length).toBeLessThanOrEqual(20);
  });

  it('handles null/undefined caption from API gracefully', () => {
    expect(extractHashtags(undefined)).toEqual([]);
    expect(extractKeywords(null)).toEqual([]);
  });
});
