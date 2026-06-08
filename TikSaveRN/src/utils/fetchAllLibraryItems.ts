/**
 * Fetches all library-listed save items via cursor pagination.
 */

import { apiService } from '../services/api';
import { SaveItem, SaveItemStatus } from '../types';

const PAGE_SIZE = 100;

/** Load every ready / needs_review item (paginated until exhausted). */
export async function fetchAllLibraryItems(signal?: AbortSignal): Promise<SaveItem[]> {
  const status: SaveItemStatus[] = ['ready', 'needs_review'];
  const collected: SaveItem[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    if (signal?.aborted) {
      break;
    }

    const response = await apiService.getItemsPaginated({
      status,
      limit: PAGE_SIZE,
      cursor,
      direction: 'next',
      signal,
    });

    collected.push(...response.items);
    hasMore = response.pagination?.hasMore ?? false;
    cursor = response.pagination?.nextCursor ?? undefined;
  }

  return collected;
}
