/**
 * Unique formatFolder mapping cases from DB row shapes.
 */

import { describe, it, expect } from 'bun:test';
import { formatFolder } from '../../services/folderCache';
import type { FolderRow } from '../../types/database';

function row(overrides: Partial<FolderRow> = {}): FolderRow {
  return {
    id: 'f-1',
    user_id: 'u-1',
    name: 'Japan',
    parent_id: null,
    icon_name: '🇯🇵',
    color_hex: '#FF0000',
    sort_order: 3,
    is_default: false,
    rules: { topics: ['Japan'] },
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-06-01'),
    item_count: '12',
    ...overrides,
  };
}

describe('formatFolder scenarios', () => {
  it('maps snake_case columns to camelCase API shape', () => {
    const formatted = formatFolder(row());
    expect(formatted.parentId).toBeNull();
    expect(formatted.iconName).toBe('🇯🇵');
    expect(formatted.colorHex).toBe('#FF0000');
    expect(formatted.sortOrder).toBe(3);
  });

  it('parses item_count string from SQL aggregate', () => {
    expect(formatFolder(row({ item_count: '0' })).itemCount).toBe(0);
    expect(formatFolder(row({ item_count: '999' })).itemCount).toBe(999);
  });

  it('preserves nested rules JSON for client-side display', () => {
    const rules = { creators: ['chef_1'], hashtags: ['foodie'] };
    expect(formatFolder(row({ rules })).rules).toEqual(rules);
  });

  it('handles subfolder with parent_id set', () => {
    const formatted = formatFolder(
      row({ id: 'child', name: 'Ramen', parent_id: 'parent-uuid', parent_name: 'Food' })
    );
    expect(formatted.parentId).toBe('parent-uuid');
    expect(formatted.name).toBe('Ramen');
  });

  it('default folder flag survives formatting', () => {
    expect(formatFolder(row({ is_default: true })).isDefault).toBe(true);
  });
});
