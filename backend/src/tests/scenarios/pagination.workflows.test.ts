/**
 * Unique multi-step pagination workflows (not repeated limit permutations).
 */

import { describe, it, expect } from 'bun:test';
import {
  encodeCursor,
  decodeCursor,
  parseCursorPagination,
  processPaginatedResults,
  buildCursorWhereClause,
} from '../../utils/pagination';

describe('pagination workflow scenarios', () => {
  it('simulates three-page forward crawl with stable cursors', () => {
    const pages = [
      [
        { id: 'c', dateAdded: '2024-03-03' },
        { id: 'b', dateAdded: '2024-03-02' },
        { id: 'a', dateAdded: '2024-03-01' },
      ],
      [
        { id: 'f', dateAdded: '2024-02-02' },
        { id: 'e', dateAdded: '2024-02-01' },
      ],
    ];

    const page1 = processPaginatedResults([...pages[0], { id: 'extra', dateAdded: '2024-02-03' }], 3, 'next');
    expect(page1.items.map((i) => i.id)).toEqual(['c', 'b', 'a']);
    expect(page1.pagination.hasMore).toBe(true);

    const cursor = page1.pagination.nextCursor!;
    const decoded = decodeCursor(cursor)!;
    expect(decoded.id).toBe('a');

    const page2 = processPaginatedResults(pages[1], 3, 'next');
    expect(page2.pagination.hasMore).toBe(false);
  });

  it('prev direction keeps ascending batch order when under limit', () => {
    const batch = [
      { id: '1', dateAdded: '2024-01-01' },
      { id: '2', dateAdded: '2024-01-02' },
    ];
    const result = processPaginatedResults(batch, 10, 'prev');
    expect(result.items.map((i) => i.id)).toEqual(['2', '1']);
  });

  it('buildCursorWhereClause uses correct SQL operator per direction', () => {
    const data = { createdAt: '2024-01-01', id: 'x' };
    expect(buildCursorWhereClause(data, 'next', 2).clause).toContain('<');
    expect(buildCursorWhereClause(data, 'prev', 2).clause).toContain('>');
  });

  it('malformed client cursor is rejected without throwing', () => {
    expect(decodeCursor('not-valid-cursor')).toBeNull();
  });

  it('limit query string "0" clamps to minimum 1', () => {
    expect(parseCursorPagination({ limit: '0' }).limit).toBe(1);
  });

  it('cursor roundtrip preserves microsecond ISO timestamps', () => {
    const ts = '2024-12-31T23:59:59.123Z';
    const id = '550e8400-e29b-41d4-a716-446655440000';
    const cursor = encodeCursor(ts, id);
    expect(decodeCursor(cursor)).toEqual({ createdAt: ts, id });
  });
});
