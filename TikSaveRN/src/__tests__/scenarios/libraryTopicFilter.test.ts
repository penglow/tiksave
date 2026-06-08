/**
 * Library category routing — unique topic parsing and filter cases.
 */

import { describe, it, expect } from 'bun:test';
import {
  parseDetectedTopic,
  itemBelongsToLibraryCategory,
  itemHasSubcategoryTopic,
} from '../../utils/libraryTopicFilter';
import { encodePaginationCursor } from '../../utils/paginationCursor';
import { buildSaveItem } from '../fixtures/generators';

describe('parseDetectedTopic scenarios', () => {
  it('capitalizes simple topic Food -> Food', () => {
    expect(parseDetectedTopic('food')).toEqual({ parentName: 'Food', subName: null });
  });

  it('splits hierarchical topic Food > Sushi', () => {
    expect(parseDetectedTopic('Food > Sushi')).toEqual({
      parentName: 'Food',
      subName: 'Sushi',
    });
  });

  it('trims whitespace around hierarchy delimiter', () => {
    expect(parseDetectedTopic(' Travel  >  Hotels ')).toEqual({
      parentName: 'Travel',
      subName: 'Hotels',
    });
  });

  it('handles empty subtopic after delimiter', () => {
    expect(parseDetectedTopic('Food > ').subName).toBeNull();
  });
});

describe('itemBelongsToLibraryCategory scenarios', () => {
  it('includes ready item under parent category', () => {
    const item = buildSaveItem({ status: 'ready', detectedTopics: ['Food > Ramen'] });
    expect(itemBelongsToLibraryCategory(item, 'Food')).toBe(true);
  });

  it('excludes processing item from library browse', () => {
    const item = buildSaveItem({ status: 'processing', detectedTopics: ['Food'] });
    expect(itemBelongsToLibraryCategory(item, 'Food')).toBe(false);
  });

  it('subcategory screen requires exact subtopic match', () => {
    const item = buildSaveItem({ detectedTopics: ['Food > Ramen'] });
    expect(itemBelongsToLibraryCategory(item, 'Food', 'Ramen')).toBe(true);
    expect(itemBelongsToLibraryCategory(item, 'Food', 'Sushi')).toBe(false);
  });

  it('needs_review items still appear in library lists', () => {
    const item = buildSaveItem({ status: 'needs_review', detectedTopics: ['Tech'] });
    expect(itemBelongsToLibraryCategory(item, 'Tech')).toBe(true);
  });

  it('defaults missing topic to Saved bucket', () => {
    const item = buildSaveItem({ detectedTopics: [] });
    expect(itemBelongsToLibraryCategory(item, 'Saved')).toBe(true);
    expect(itemBelongsToLibraryCategory(item, 'Food')).toBe(false);
  });

  it('failed uploads never appear in category browse', () => {
    const item = buildSaveItem({ status: 'failed', detectedTopics: ['Food'] });
    expect(itemBelongsToLibraryCategory(item, 'Food')).toBe(false);
  });
});

describe('itemHasSubcategoryTopic', () => {
  it('is false for parent-only topics', () => {
    const item = buildSaveItem({ detectedTopics: ['Food'] });
    expect(itemHasSubcategoryTopic(item)).toBe(false);
  });

  it('is true when topic has a subcategory segment', () => {
    const item = buildSaveItem({ detectedTopics: ['Food > Ramen'] });
    expect(itemHasSubcategoryTopic(item)).toBe(true);
  });
});

describe('encodePaginationCursor', () => {
  it('uses base64url without padding', () => {
    const cursor = encodePaginationCursor('2024-01-01T00:00:00.000Z', 'abc-123');
    expect(cursor).not.toContain('+');
    expect(cursor).not.toContain('/');
    expect(cursor).not.toContain('=');
    expect(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))).toEqual({
      createdAt: '2024-01-01T00:00:00.000Z',
      id: 'abc-123',
    });
  });
});
