/**
 * Unique classification scenarios — each test is a distinct filing story.
 */

import { describe, it, expect } from 'bun:test';
import { classifyItemWithFolders } from '../../services/classification';

const baseFolder = (overrides: Record<string, unknown>) => ({
  id: 'folder-1',
  name: 'Food',
  parent_id: null,
  parent_name: null,
  rules: {},
  weights: {},
  ...overrides,
});

describe('classification scenarios', () => {
  it('creator hard-rule overrides low topic signal', async () => {
    const result = await classifyItemWithFolders(
      'user-1',
      [
        baseFolder({ id: 'f-creator', name: 'Chef Picks', rules: { creators: ['ramen_master'] } }),
        baseFolder({ id: 'f-food', name: 'Food' }),
      ],
      { topics: ['Tech'], labels: [], hashtags: [], creatorUsername: 'ramen_master' }
    );
    expect(result.folderName).toBe('Chef Picks');
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('hierarchical topic matches parent + subfolder exactly', async () => {
    const result = await classifyItemWithFolders(
      'user-1',
      [
        baseFolder({
          id: 'f-sub',
          name: 'Street Food',
          parent_id: 'p1',
          parent_name: 'Food',
        }),
        baseFolder({ id: 'f-food', name: 'Food' }),
      ],
      { topics: ['Food > Street Food'], labels: [], hashtags: [] }
    );
    expect(result.folderName).toBe('Street Food');
    expect(result.reasons.some((r) => r.includes('Hierarchical'))).toBe(true);
  });

  it('tokyo topic semantically boosts japan folder', async () => {
    const result = await classifyItemWithFolders(
      'user-1',
      [baseFolder({ id: 'f-japan', name: 'Japan' }), baseFolder({ id: 'f-food', name: 'Food' })],
      { topics: ['Tokyo'], labels: [], hashtags: [] }
    );
    expect(result.folderName).toBe('Japan');
  });

  it('generic shopping does not hijack japan shopping folder (coverage penalty)', async () => {
    const result = await classifyItemWithFolders(
      'user-1',
      [
        baseFolder({ id: 'f-jshop', name: 'Japan Shopping' }),
        baseFolder({ id: 'f-shop', name: 'Shopping' }),
      ],
      { topics: ['shopping'], labels: [], hashtags: [] }
    );
    expect(result.folderName).toBe('Shopping');
  });

  it('hashtag foodie scores food folder but needs stronger signal to auto-assign', async () => {
    const result = await classifyItemWithFolders(
      'user-1',
      [baseFolder({ id: 'f-food', name: 'Food' }), baseFolder({ id: 'f-travel', name: 'Travel' })],
      { topics: [], labels: [], hashtags: ['#foodie'] }
    );
    expect(result.folderId).toBeNull();
    expect(result.reasons.some((r) => r.toLowerCase().includes('food'))).toBe(true);
  });

  it('hashtag plus topic crosses auto-assign confidence threshold', async () => {
    const result = await classifyItemWithFolders(
      'user-1',
      [baseFolder({ id: 'f-food', name: 'Food' })],
      { topics: ['Food'], labels: [], hashtags: ['#foodie'] }
    );
    expect(result.folderName).toBe('Food');
    expect(result.confidence).toBeGreaterThanOrEqual(0.3);
  });

  it('learned creator weight tips tie toward habitual folder', async () => {
    const result = await classifyItemWithFolders(
      'user-1',
      [
        baseFolder({
          id: 'f-gym',
          name: 'Gym',
          weights: { creatorWeights: { fit_coach: 2 } },
        }),
        baseFolder({ id: 'f-food', name: 'Food' }),
      ],
      { topics: ['Food'], labels: [], hashtags: [], creatorUsername: 'fit_coach' }
    );
    expect(result.folderName).toBe('Gym');
  });

  it('empty folders list returns explicit no-folders reason', async () => {
    const result = await classifyItemWithFolders('user-1', [], {
      topics: ['Food'],
      labels: [],
      hashtags: [],
    });
    expect(result.folderId).toBeNull();
    expect(result.reasons).toContain('No folders available');
  });

  it('no signals refuses assignment even with folders present', async () => {
    const result = await classifyItemWithFolders(
      'user-1',
      [baseFolder({ id: 'f1', name: 'Inbox' })],
      { topics: [], labels: [], hashtags: [] }
    );
    expect(result.folderId).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it('transcript hotel keywords produce reasons before meeting assign threshold', async () => {
    const result = await classifyItemWithFolders(
      'user-1',
      [baseFolder({ id: 'f-hotel', name: 'Hotels' }), baseFolder({ id: 'f-food', name: 'Food' })],
      {
        topics: [],
        labels: [],
        hashtags: [],
        transcriptText: 'We loved the room and check in was smooth at this hotel',
      }
    );
    expect(result.folderId).toBeNull();
    expect(result.reasons.some((r) => r.includes('room') || r.includes('check in'))).toBe(true);
  });

  it('returns up to three alternative folders sorted by score', async () => {
    const result = await classifyItemWithFolders(
      'user-1',
      [
        baseFolder({ id: 'f-food', name: 'Food' }),
        baseFolder({ id: 'f-travel', name: 'Travel' }),
        baseFolder({ id: 'f-tech', name: 'Tech' }),
        baseFolder({ id: 'f-gym', name: 'Gym' }),
      ],
      { topics: ['Food', 'Travel'], labels: ['restaurant'], hashtags: ['#foodie'] }
    );
    expect(result.folderName).toBe('Food');
    expect(result.alternativeFolders.length).toBeLessThanOrEqual(3);
    expect(result.alternativeFolders[0]?.folderName).not.toBe('Food');
  });

  it('label ramen maps to food via semantic category', async () => {
    const result = await classifyItemWithFolders(
      'user-1',
      [baseFolder({ id: 'f-food', name: 'Food' }), baseFolder({ id: 'f-japan', name: 'Japan' })],
      { topics: [], labels: ['ramen'], hashtags: [] }
    );
    expect(result.folderName).toBe('Food');
  });

  it('competing folders picks highest score not alphabetically first', async () => {
    const result = await classifyItemWithFolders(
      'user-1',
      [
        baseFolder({ id: 'a', name: 'Attractions' }),
        baseFolder({ id: 'z', name: 'Food' }),
      ],
      { topics: ['Food'], labels: ['restaurant'], hashtags: [] }
    );
    expect(result.folderName).toBe('Food');
  });
});
