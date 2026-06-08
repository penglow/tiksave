/**
 * User settings and library sort label contracts.
 */

import { describe, it, expect } from 'bun:test';
import {
  DEFAULT_USER_SETTINGS,
  LIBRARY_CATEGORY_SORT_LABELS,
  LIBRARY_WITHIN_TOPIC_LABELS,
  type LibraryCategorySort,
  type LibraryWithinTopicSort,
} from '../../types';

describe('user settings contract scenarios', () => {
  it('default confidence threshold matches high-confidence auto-file UX', () => {
    expect(DEFAULT_USER_SETTINGS.confidenceThreshold).toBe(0.85);
    expect(DEFAULT_USER_SETTINGS.autoFileHighConfidence).toBe(true);
  });

  it('every library category sort option has user-facing label', () => {
    const keys: LibraryCategorySort[] = [
      'videos_desc',
      'videos_asc',
      'name_asc',
      'name_desc',
      'recent_activity',
    ];
    for (const k of keys) {
      expect(LIBRARY_CATEGORY_SORT_LABELS[k]).toMatch(/\w/);
    }
  });

  it('within-topic sort labels describe clip ordering clearly', () => {
    const keys: LibraryWithinTopicSort[] = ['newest_first', 'oldest_first'];
    for (const k of keys) {
      expect(LIBRARY_WITHIN_TOPIC_LABELS[k].toLowerCase()).toContain('clip');
    }
  });

  it('default theme is system to respect OS appearance', () => {
    expect(DEFAULT_USER_SETTINGS.theme).toBe('system');
  });

  it('retention default is positive number of days', () => {
    expect(DEFAULT_USER_SETTINGS.defaultInboxRetention).toBeGreaterThan(0);
  });
});
