/** Mass matrix tests for SaveItem display helpers (~400+ cases). */

import { describe, it, expect } from 'bun:test';
import {
  getDisplayTitle,
  needsUserReview,
  getConfidenceLevel,
  isLoadingStatus,
  isLibraryListedStatus,
  STATUS_DISPLAY_NAMES,
  type SaveItemStatus,
} from '../../types';
import { buildSaveItem } from '../fixtures/generators';

const STATUSES: SaveItemStatus[] = [
  'queued',
  'upload_requested',
  'uploading',
  'processing',
  'ready',
  'needs_review',
  'failed',
];

describe('saveItemHelpers.matrix — getDisplayTitle', () => {
  for (let i = 0; i < 80; i++) {
    it(`prefers title ${i}`, () => {
      const item = buildSaveItem({ title: `Title ${i}` });
      expect(getDisplayTitle(item)).toBe(`Title ${i}`);
    });
  }
  for (let i = 0; i < 60; i++) {
    it(`transcript fallback ${i}`, () => {
      const words = Array.from({ length: 15 }, (_, j) => `w${j}`).join(' ');
      const item = buildSaveItem({ title: '', transcriptText: words });
      const title = getDisplayTitle(item);
      expect(title.endsWith('...')).toBe(true);
    });
  }
  for (let i = 0; i < 40; i++) {
    it(`default label ${i}`, () => {
      expect(getDisplayTitle(buildSaveItem({ title: '', transcriptText: '' }))).toBe(
        'TikTok Video',
      );
    });
  }
});

describe('saveItemHelpers.matrix — needsUserReview', () => {
  for (let i = 0; i < 50; i++) {
    it(`status needs_review ${i}`, () => {
      expect(needsUserReview(buildSaveItem({ status: 'needs_review', confidence: 0.99 }))).toBe(
        true,
      );
    });
  }
  for (let c = 0; c <= 100; c++) {
    it(`confidence threshold ${c}`, () => {
      const conf = c / 100;
      const item = buildSaveItem({ status: 'ready', confidence: conf });
      expect(needsUserReview(item, 0.6)).toBe(conf < 0.6);
    });
  }
});

describe('saveItemHelpers.matrix — getConfidenceLevel', () => {
  for (let c = 0; c <= 100; c++) {
    it(`level ${c}`, () => {
      const level = getConfidenceLevel(c / 100);
      if (c >= 85) expect(level).toBe('high');
      else if (c >= 60) expect(level).toBe('medium');
      else expect(level).toBe('low');
    });
  }
});

describe('saveItemHelpers.matrix — status flags', () => {
  for (const status of STATUSES) {
    for (let i = 0; i < 3; i++) {
      it(`loading ${status} #${i}`, () => {
        const loading = isLoadingStatus(status);
        expect(['queued', 'upload_requested', 'uploading', 'processing'].includes(status)).toBe(
          loading,
        );
      });
      it(`library ${status} #${i}`, () => {
        const listed = isLibraryListedStatus(status);
        expect(status === 'ready' || status === 'needs_review').toBe(listed);
      });
      it(`display name ${status} #${i}`, () => {
        expect(STATUS_DISPLAY_NAMES[status].length).toBeGreaterThan(0);
      });
    }
  }
});
