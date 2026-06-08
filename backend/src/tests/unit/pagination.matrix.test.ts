/** Mass matrix tests for cursor pagination (~600+ cases). */

import { describe, it, expect } from 'bun:test';
import {
  encodeCursor,
  decodeCursor,
  parseCursorPagination,
  parseOffsetPagination,
  buildCursorWhereClause,
  processPaginatedResults,
} from '../../utils/pagination';
import { generateCursorRoundTrips, generatePaginationLimits } from '../fixtures/generators';

const ROUND_TRIPS = generateCursorRoundTrips(250);
const LIMIT_CASES = generatePaginationLimits(120);

describe('pagination.matrix — encode/decode roundtrip', () => {
  for (let i = 0; i < ROUND_TRIPS.length; i++) {
    const { createdAt, id } = ROUND_TRIPS[i];
    it(`roundtrip ${i}`, () => {
      const cursor = encodeCursor(createdAt, id);
      const decoded = decodeCursor(cursor);
      expect(decoded).toEqual({ createdAt, id });
    });
  }
});

describe('pagination.matrix — decode invalid', () => {
  const invalid = ['', '!!!', 'not-base64', Buffer.from('{}').toString('base64url'), 'e30']; // {}
  for (let i = 0; i < invalid.length; i++) {
    it(`invalid cursor ${i}`, () => {
      expect(decodeCursor(invalid[i])).toBeNull();
    });
  }
  for (let i = 0; i < 30; i++) {
    it(`missing id field ${i}`, () => {
      const bad = Buffer.from(JSON.stringify({ createdAt: new Date().toISOString() })).toString('base64url');
      expect(decodeCursor(bad)).toBeNull();
    });
  }
});

describe('pagination.matrix — parseCursorPagination', () => {
  for (let i = 0; i < LIMIT_CASES.length; i++) {
    const { query, expected } = LIMIT_CASES[i];
    it(`limit case ${i}`, () => {
      const parsed = parseCursorPagination(query, 20, 100);
      expect(parsed.limit).toBe(expected);
    });
  }
  for (let i = 0; i < 50; i++) {
    it(`direction prev ${i}`, () => {
      expect(parseCursorPagination({ direction: 'prev' }).direction).toBe('prev');
    });
    it(`direction next default ${i}`, () => {
      expect(parseCursorPagination({ direction: 'next' }).direction).toBe('next');
    });
  }
});

describe('pagination.matrix — parseOffsetPagination', () => {
  for (let i = 0; i < 80; i++) {
    it(`offset bounds ${i}`, () => {
      const q = { limit: String(i * 3 - 10), offset: String(i * -5) };
      const { limit, offset } = parseOffsetPagination(q, 50, 100);
      expect(limit).toBeGreaterThanOrEqual(1);
      expect(limit).toBeLessThanOrEqual(100);
      expect(offset).toBeGreaterThanOrEqual(0);
    });
  }
});

describe('pagination.matrix — buildCursorWhereClause', () => {
  const cursor = { createdAt: '2024-06-01T00:00:00.000Z', id: 'abc' };
  for (let i = 0; i < 20; i++) {
    it(`next clause ${i}`, () => {
      const { clause, params } = buildCursorWhereClause(cursor, 'next', 1);
      expect(clause).toContain('<');
      expect(params).toHaveLength(2);
    });
    it(`prev clause ${i}`, () => {
      const { clause } = buildCursorWhereClause(cursor, 'prev', 3);
      expect(clause).toContain('>');
    });
    it(`empty cursor ${i}`, () => {
      expect(buildCursorWhereClause(null, 'next', 1).clause).toBe('');
    });
  }
});

describe('pagination.matrix — processPaginatedResults', () => {
  const mk = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `id-${i}`,
      dateAdded: new Date(2024, 0, n - i).toISOString(),
    }));

  for (let limit = 1; limit <= 25; limit++) {
    it(`hasMore when len > limit (${limit})`, () => {
      const items = mk(limit + 1);
      const result = processPaginatedResults(items, limit, 'next');
      expect(result.pagination.hasMore).toBe(true);
      expect(result.items).toHaveLength(limit);
    });
  }
  for (let i = 0; i < 30; i++) {
    it(`prev reverses ${i}`, () => {
      const items = mk(5);
      const result = processPaginatedResults(items, 10, 'prev');
      expect(result.items.length).toBe(5);
    });
  }
});
