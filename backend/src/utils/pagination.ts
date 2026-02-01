/**
 * Cursor-based pagination utilities
 * Provides efficient pagination for large datasets
 */

export interface CursorPaginationParams {
  cursor?: string;      // Base64 encoded "created_at:id"
  limit?: number;       // Items per page (default: 20, max: 100)
  direction?: 'next' | 'prev'; // Direction of pagination
}

export interface CursorPaginationResult<T> {
  items: T[];
  pagination: {
    nextCursor: string | null;
    prevCursor: string | null;
    hasMore: boolean;
    total?: number;     // Optional: total count (expensive query)
  };
}

export interface CursorData {
  createdAt: string;
  id: string;
}

/**
 * Encode cursor data to base64 string
 */
export function encodeCursor(createdAt: string | Date, id: string): string {
  const timestamp = typeof createdAt === 'string' ? createdAt : createdAt.toISOString();
  const data: CursorData = { createdAt: timestamp, id };
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

/**
 * Decode cursor string to cursor data
 */
export function decodeCursor(cursor: string): CursorData | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf-8');
    const data = JSON.parse(decoded) as CursorData;
    
    // Validate required fields
    if (!data.createdAt || !data.id) {
      return null;
    }
    
    return data;
  } catch {
    return null;
  }
}

/**
 * Parse pagination parameters from query string
 */
export function parseCursorPagination(
  query: Record<string, unknown>,
  defaultLimit = 20,
  maxLimit = 100
): Required<CursorPaginationParams> {
  const cursor = typeof query.cursor === 'string' ? query.cursor : undefined;
  
  // Parse limit with bounds checking
  let limit = defaultLimit;
  if (query.limit !== undefined) {
    const parsed = parseInt(String(query.limit), 10);
    if (!isNaN(parsed)) {
      limit = Math.max(1, Math.min(maxLimit, parsed));
    }
  }
  
  // Validate direction
  const direction = query.direction === 'prev' ? 'prev' : 'next';
  
  return { cursor, limit, direction };
}

/**
 * Build WHERE clause for cursor-based pagination
 * Returns the clause and parameters array
 */
export function buildCursorWhereClause(
  cursorData: CursorData | null,
  direction: 'next' | 'prev',
  baseParamIndex: number
): { clause: string; params: (string | number)[]; nextParamIndex: number } {
  if (!cursorData) {
    return { clause: '', params: [], nextParamIndex: baseParamIndex };
  }
  
  const params: (string | number)[] = [cursorData.createdAt, cursorData.id];
  const operator = direction === 'next' ? '<' : '>';
  
  // Use row value constructor for efficient comparison
  // (created_at, id) < (cursor.createdAt, cursor.id)
  const clause = `(created_at, id) ${operator} ($${baseParamIndex}, $${baseParamIndex + 1})`;
  
  return { clause, params, nextParamIndex: baseParamIndex + 2 };
}

/**
 * Build complete paginated query
 */
export function buildPaginatedQuery(
  baseQuery: string,
  baseWhereClause: string,
  cursorData: CursorData | null,
  direction: 'next' | 'prev',
  limit: number,
  baseParams: unknown[] = []
): { query: string; params: unknown[]; orderBy: string } {
  const cursorWhere = buildCursorWhereClause(cursorData, direction, baseParams.length + 1);
  
  // Build WHERE clause combining base and cursor conditions
  let whereClause = baseWhereClause;
  if (cursorWhere.clause) {
    whereClause = baseWhereClause 
      ? `${baseWhereClause} AND ${cursorWhere.clause}`
      : `WHERE ${cursorWhere.clause}`;
  } else if (baseWhereClause) {
    whereClause = `WHERE ${baseWhereClause}`;
  }
  
  // Determine sort order based on direction
  // For 'next', we want newest first (DESC)
  // For 'prev', we want oldest first (ASC) then reverse results
  const orderBy = direction === 'next' 
    ? 'ORDER BY created_at DESC, id DESC'
    : 'ORDER BY created_at ASC, id ASC';
  
  // Build final query
  // Fetch one extra item to determine if there's a next/prev page
  const query = `${baseQuery} ${whereClause} ${orderBy} LIMIT $${cursorWhere.nextParamIndex}`;
  const params = [...baseParams, ...cursorWhere.params, limit + 1];
  
  return { query, params, orderBy };
}

/**
 * Process query results to extract pagination cursors
 */
export function processPaginatedResults<T extends { id: string; dateAdded: string | Date }>(
  items: T[],
  limit: number,
  direction: 'next' | 'prev'
): CursorPaginationResult<T> {
  // Check if we have more items (we fetched limit + 1)
  const hasMore = items.length > limit;
  
  // Remove the extra item we fetched
  const actualItems = hasMore ? items.slice(0, limit) : items;
  
  // If we're paginating backwards, reverse the items to maintain consistent order
  const finalItems = direction === 'prev' ? [...actualItems].reverse() : actualItems;
  
  // Generate cursors
  let nextCursor: string | null = null;
  let prevCursor: string | null = null;
  
  if (finalItems.length > 0) {
    // For next page: use the last item's cursor
    if (hasMore || direction === 'prev') {
      const lastItem = finalItems[finalItems.length - 1];
      nextCursor = encodeCursor(lastItem.dateAdded, lastItem.id);
    }
    
    // For prev page: use the first item's cursor
    if (direction === 'next' && finalItems.length > 0) {
      const firstItem = finalItems[0];
      prevCursor = encodeCursor(firstItem.dateAdded, firstItem.id);
    }
  }
  
  return {
    items: finalItems,
    pagination: {
      nextCursor,
      prevCursor,
      hasMore,
    },
  };
}

/**
 * Parse legacy offset-based pagination (for backward compatibility)
 */
export function parseOffsetPagination(
  query: Record<string, unknown>,
  defaultLimit = 50,
  maxLimit = 100
): { limit: number; offset: number } {
  let limit = defaultLimit;
  if (query.limit !== undefined) {
    const parsed = parseInt(String(query.limit), 10);
    if (!isNaN(parsed)) {
      limit = Math.max(1, Math.min(maxLimit, parsed));
    }
  }
  
  let offset = 0;
  if (query.offset !== undefined) {
    const parsed = parseInt(String(query.offset), 10);
    if (!isNaN(parsed)) {
      offset = Math.max(0, parsed);
    }
  }
  
  return { limit, offset };
}
