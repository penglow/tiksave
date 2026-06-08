/**
 * Cursor-based pagination hook for save items with in-memory page cache.
 * Supports load-more, refresh, and optimistic list mutations.
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { apiService } from '../services/api';
import { SaveItem, SaveItemStatus } from '../types';
import { usePaginationCacheStore } from '../stores/paginationCacheStore';
import { encodePaginationCursor } from '../utils/paginationCursor';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UsePaginatedItemsOptions {
  status?: SaveItemStatus | SaveItemStatus[];
  folderId?: string;
  limit?: number;
}

interface PaginatedItemsState {
  items: SaveItem[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  nextCursor: string | null;
  prevCursor: string | null;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Overlay server batch onto accumulated items by id (server wins conflicts), newest-first globally. */
function mergeItemsUnionNewestFirst(previous: SaveItem[], overlayPage: SaveItem[]): SaveItem[] {
  const map = new Map<string, SaveItem>();
  for (const item of previous) {
    map.set(item.id, item);
  }
  for (const item of overlayPage) {
    map.set(item.id, item);
  }
  return [...map.values()].sort(
    (a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime(),
  );
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Cursor-based pagination for save items.
 * Efficiently handles large datasets by loading items in pages.
 *
 * @param options - Status filter, folder scope, and page size.
 */
export function usePaginatedItems(options: UsePaginatedItemsOptions = {}) {
  const { status, folderId, limit = 20 } = options;
  const cacheTtlMs = 60 * 1000;
  const statusKey =
    status === undefined
      ? 'all'
      : Array.isArray(status)
        ? [...status].slice().sort().join('+')
        : status;
  const cacheKey = `status:${statusKey}:folder:${folderId || 'all'}:limit:${limit}`;
  const getPage = usePaginationCacheStore((s) => s.getPage);
  const setPage = usePaginationCacheStore((s) => s.setPage);

  /** Stable by value — avoids infinite loops when parent passes `['ready','needs_review']` inline each render. */
  const statusFilter = useMemo((): SaveItemStatus | SaveItemStatus[] | undefined => {
    if (status === undefined) return undefined;
    if (!Array.isArray(status)) return status;
    return [...status].sort() as SaveItemStatus[];
  }, [statusKey]);

  const [state, setState] = useState<PaginatedItemsState>({
    items: [],
    isLoading: true,
    isLoadingMore: false,
    hasMore: true,
    nextCursor: null,
    prevCursor: null,
    error: null,
  });

  // Use refs to track loading state to prevent race conditions
  const isLoadingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const beginRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    return controller;
  }, []);

  /** Load first page (`merge: false`), or reconcile first page onto existing pages (`merge: true`). */
  const loadItems = useCallback(
    async (opts?: { merge?: boolean }) => {
      if (isLoadingRef.current) return;

      isLoadingRef.current = true;
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const controller = beginRequest();

      try {
        if (!opts?.merge) {
          const cached = getPage(cacheKey);
          if (cached && Date.now() - cached.updatedAt < cacheTtlMs) {
            if (!controller.signal.aborted) {
              setState({
                items: cached.items,
                isLoading: false,
                isLoadingMore: false,
                hasMore: cached.hasMore,
                nextCursor: cached.nextCursor,
                prevCursor: cached.prevCursor,
                error: null,
              });
            }
            return;
          }
        }

        const response = await apiService.getItemsPaginated({
          status: statusFilter,
          folderId,
          limit,
          direction: 'next',
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        if (opts?.merge) {
          let mergedItems: SaveItem[] = [];
          setState((prev) => {
            mergedItems = mergeItemsUnionNewestFirst(prev.items, response.items);
            return {
              ...prev,
              items: mergedItems,
              isLoading: false,
              isLoadingMore: false,
              hasMore: response.pagination?.hasMore ?? false,
              nextCursor: response.pagination?.nextCursor ?? null,
              prevCursor: response.pagination?.prevCursor ?? null,
              error: null,
            };
          });
          setPage(cacheKey, {
            items: mergedItems,
            hasMore: response.pagination?.hasMore ?? false,
            nextCursor: response.pagination?.nextCursor ?? null,
            prevCursor: response.pagination?.prevCursor ?? null,
            updatedAt: Date.now(),
          });
          return;
        }

        setState({
          items: response.items,
          isLoading: false,
          isLoadingMore: false,
          hasMore: response.pagination?.hasMore ?? false,
          nextCursor: response.pagination?.nextCursor ?? null,
          prevCursor: response.pagination?.prevCursor ?? null,
          error: null,
        });

        setPage(cacheKey, {
          items: response.items,
          hasMore: response.pagination?.hasMore ?? false,
          nextCursor: response.pagination?.nextCursor ?? null,
          prevCursor: response.pagination?.prevCursor ?? null,
          updatedAt: Date.now(),
        });
      } catch (err) {
        if (isAbortError(err)) return;
        const errorMessage = err instanceof Error ? err.message : 'Failed to load items';
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));
      } finally {
        isLoadingRef.current = false;
      }
    },
    [folderId, limit, cacheKey, cacheTtlMs, getPage, setPage, statusFilter, beginRequest],
  );

  /** Load the next page of items. */
  const loadMore = useCallback(async () => {
    if (isLoadingRef.current || !state.hasMore || !state.nextCursor) return;

    isLoadingRef.current = true;
    setState((prev) => ({ ...prev, isLoadingMore: true }));

    try {
      const response = await apiService.getItemsPaginated({
        status: statusFilter,
        folderId,
        cursor: state.nextCursor,
        limit,
        direction: 'next',
        signal: abortControllerRef.current?.signal,
      });

      if (abortControllerRef.current?.signal.aborted) return;

      let mergedItems: SaveItem[] = [];
      let hasMore = false;
      let nextCursor: string | null = null;
      let prevCursor: string | null = null;
      setState((prev) => {
        mergedItems = mergeItemsUnionNewestFirst(prev.items, response.items);
        hasMore = response.pagination?.hasMore ?? false;
        nextCursor = response.pagination?.nextCursor ?? null;
        prevCursor = response.pagination?.prevCursor ?? null;
        return {
          ...prev,
          items: mergedItems,
          isLoadingMore: false,
          hasMore,
          nextCursor,
          prevCursor,
        };
      });

      setPage(cacheKey, {
        items: mergedItems,
        hasMore,
        nextCursor,
        prevCursor,
        updatedAt: Date.now(),
      });
    } catch (err) {
      if (isAbortError(err)) return;
      const errorMessage = err instanceof Error ? err.message : 'Failed to load more items';
      setState((prev) => ({
        ...prev,
        isLoadingMore: false,
        error: errorMessage,
      }));
    } finally {
      isLoadingRef.current = false;
    }
  }, [statusFilter, folderId, limit, state.hasMore, state.nextCursor, cacheKey, setPage]);

  /** Load the previous page (bi-directional pagination). */
  const loadPrevious = useCallback(async () => {
    if (isLoadingRef.current || !state.prevCursor) return;

    isLoadingRef.current = true;
    setState((prev) => ({ ...prev, isLoadingMore: true }));

    try {
      const response = await apiService.getItemsPaginated({
        status: statusFilter,
        folderId,
        cursor: state.prevCursor,
        limit,
        direction: 'prev',
        signal: abortControllerRef.current?.signal,
      });

      if (abortControllerRef.current?.signal.aborted) return;

      setState((prev) => ({
        ...prev,
        items: [...response.items, ...prev.items],
        isLoadingMore: false,
        hasMore: response.pagination?.hasMore ?? prev.hasMore,
        nextCursor: response.pagination?.nextCursor ?? prev.nextCursor,
        prevCursor: response.pagination?.prevCursor ?? null,
      }));
    } catch (err) {
      if (isAbortError(err)) return;
      const errorMessage = err instanceof Error ? err.message : 'Failed to load previous items';
      setState((prev) => ({
        ...prev,
        isLoadingMore: false,
        error: errorMessage,
      }));
    } finally {
      isLoadingRef.current = false;
    }
  }, [statusFilter, folderId, limit, state.prevCursor]);

  /** Refresh items while maintaining scroll position. */
  const refresh = useCallback(async () => {
    const controller = beginRequest();

    setState((prev) => ({ ...prev, isLoadingMore: true, error: null }));

    try {
      // If we have items, fetch from the first item's cursor backwards
      // This gives us any new items inserted at the top
      if (state.items.length > 0) {
        const firstItem = state.items[0];
        const cursor =
          state.prevCursor ?? encodePaginationCursor(firstItem.dateAdded, firstItem.id);

        const response = await apiService.getItemsPaginated({
          status: statusFilter,
          folderId,
          cursor,
          limit,
          direction: 'prev',
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        // Filter out duplicates and prepend new items
        const existingIds = new Set(state.items.map((item) => item.id));
        const newItems = response.items.filter((item) => !existingIds.has(item.id));
        let mergedItems: SaveItem[] = [];
        let prevCursor: string | null = null;

        setState((prev) => {
          mergedItems = [...newItems, ...prev.items];
          prevCursor = response.pagination?.prevCursor ?? prev.prevCursor;
          return {
            ...prev,
            items: mergedItems,
            isLoadingMore: false,
            prevCursor,
          };
        });

        setPage(cacheKey, {
          items: mergedItems,
          hasMore: state.hasMore,
          nextCursor: state.nextCursor,
          prevCursor,
          updatedAt: Date.now(),
        });
      } else {
        // No items yet, just do a fresh load
        await loadItems();
      }
    } catch (err) {
      if (isAbortError(err)) return;
      setState((prev) => ({
        ...prev,
        isLoadingMore: false,
        error: err instanceof Error ? err.message : 'Failed to refresh',
      }));
    }
  }, [
    folderId,
    limit,
    state.items,
    state.hasMore,
    state.nextCursor,
    state.prevCursor,
    loadItems,
    cacheKey,
    setPage,
    statusFilter,
    beginRequest,
  ]);

  /** Update a single item in the list (for optimistic updates). */
  const updateItem = useCallback(
    (itemId: string, updates: Partial<SaveItem>) => {
      setState((prev) => ({
        ...prev,
        items: prev.items.map((item) => (item.id === itemId ? { ...item, ...updates } : item)),
      }));
      const cached = getPage(cacheKey);
      if (cached) {
        setPage(cacheKey, {
          ...cached,
          items: cached.items.map((item) => (item.id === itemId ? { ...item, ...updates } : item)),
          updatedAt: Date.now(),
        });
      }
    },
    [cacheKey, getPage, setPage],
  );

  /** Remove an item from the list. */
  const removeItem = useCallback(
    (itemId: string) => {
      setState((prev) => ({
        ...prev,
        items: prev.items.filter((item) => item.id !== itemId),
      }));
      const cached = getPage(cacheKey);
      if (cached) {
        setPage(cacheKey, {
          ...cached,
          items: cached.items.filter((item) => item.id !== itemId),
          updatedAt: Date.now(),
        });
      }
    },
    [cacheKey, getPage, setPage],
  );

  /** Add a new item to the list. */
  const addItem = useCallback(
    (item: SaveItem, atBeginning = true) => {
      setState((prev) => ({
        ...prev,
        items: atBeginning ? [item, ...prev.items] : [...prev.items, item],
      }));
      const cached = getPage(cacheKey);
      if (cached) {
        setPage(cacheKey, {
          ...cached,
          items: atBeginning ? [item, ...cached.items] : [...cached.items, item],
          updatedAt: Date.now(),
        });
      }
    },
    [cacheKey, getPage, setPage],
  );

  return {
    ...state,
    loadItems,
    loadMore,
    loadPrevious,
    refresh,
    updateItem,
    removeItem,
    addItem,
  };
}
