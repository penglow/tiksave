/**
 * Cursor encoding for paginated item APIs (matches backend base64url format).
 */

export interface PaginationCursorData {
  createdAt: string;
  id: string;
}

/** Encode `{ createdAt, id }` as base64url for `/items/paginated` cursors. */
export function encodePaginationCursor(createdAt: string, id: string): string {
  const payload = JSON.stringify({ createdAt, id } satisfies PaginationCursorData);
  const base64 =
    typeof btoa !== 'undefined' ? btoa(payload) : Buffer.from(payload, 'utf8').toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
