import { useState, useCallback, useRef } from 'react';
import { apiService } from '../services/api';
import { SaveItem, SaveItemStatus } from '../types';

interface UsePaginatedItemsOptions {
  status?: SaveItemStatus;
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

/**
 * Hook for cursor-based pagination of items
 * Efficiently handles large datasets by loading items in pages
 */
export function usePaginatedItems(options: UsePaginatedItemsOptions = {}) {
  const { status, folderId, limit = 20 } = options;
  
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

  /**
   * Load initial items or refresh
   */
  const loadItems = useCallback(async () => {
    if (isLoadingRef.current) return;
    
    isLoadingRef.current = true;
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    // Cancel any in-flight requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const response = await apiService.getItemsPaginated({
        status,
        folderId,
        limit,
        direction: 'next',
      });

      setState({
        items: response.items,
        isLoading: false,
        isLoadingMore: false,
        hasMore: response.pagination?.hasMore ?? false,
        nextCursor: response.pagination?.nextCursor ?? null,
        prevCursor: response.pagination?.prevCursor ?? null,
        error: null,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load items';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    } finally {
      isLoadingRef.current = false;
    }
  }, [status, folderId, limit]);

  /**
   * Load more items (next page)
   */
  const loadMore = useCallback(async () => {
    if (isLoadingRef.current || !state.hasMore || !state.nextCursor) return;
    
    isLoadingRef.current = true;
    setState(prev => ({ ...prev, isLoadingMore: true }));

    try {
      const response = await apiService.getItemsPaginated({
        status,
        folderId,
        cursor: state.nextCursor,
        limit,
        direction: 'next',
      });

      setState(prev => ({
        ...prev,
        items: [...prev.items, ...response.items],
        isLoadingMore: false,
        hasMore: response.pagination?.hasMore ?? false,
        nextCursor: response.pagination?.nextCursor ?? null,
        prevCursor: response.pagination?.prevCursor ?? null,
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load more items';
      setState(prev => ({
        ...prev,
        isLoadingMore: false,
        error: errorMessage,
      }));
    } finally {
      isLoadingRef.current = false;
    }
  }, [status, folderId, limit, state.hasMore, state.nextCursor]);

  /**
   * Load previous page (for bi-directional pagination)
   */
  const loadPrevious = useCallback(async () => {
    if (isLoadingRef.current || !state.prevCursor) return;
    
    isLoadingRef.current = true;
    setState(prev => ({ ...prev, isLoadingMore: true }));

    try {
      const response = await apiService.getItemsPaginated({
        status,
        folderId,
        cursor: state.prevCursor,
        limit,
        direction: 'prev',
      });

      setState(prev => ({
        ...prev,
        items: [...response.items, ...prev.items],
        isLoadingMore: false,
        hasMore: response.pagination?.hasMore ?? prev.hasMore,
        nextCursor: response.pagination?.nextCursor ?? prev.nextCursor,
        prevCursor: response.pagination?.prevCursor ?? null,
      }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load previous items';
      setState(prev => ({
        ...prev,
        isLoadingMore: false,
        error: errorMessage,
      }));
    } finally {
      isLoadingRef.current = false;
    }
  }, [status, folderId, limit, state.prevCursor]);

  /**
   * Refresh items while maintaining scroll position
   */
  const refresh = useCallback(async () => {
    // Cancel any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setState(prev => ({ ...prev, isLoadingMore: true, error: null }));
    
    try {
      // If we have items, fetch from the first item's cursor backwards
      // This gives us any new items inserted at the top
      if (state.items.length > 0) {
        const firstItem = state.items[0];
        const cursor = btoa(JSON.stringify({ 
          createdAt: firstItem.dateAdded, 
          id: firstItem.id 
        }));
        
        const response = await apiService.getItemsPaginated({
          status,
          folderId,
          cursor,
          limit: 20,
          direction: 'prev',
        });

        // Filter out duplicates and prepend new items
        const existingIds = new Set(state.items.map(item => item.id));
        const newItems = response.items.filter(item => !existingIds.has(item.id));
        
        setState(prev => ({
          ...prev,
          items: [...newItems, ...prev.items],
          isLoadingMore: false,
          prevCursor: response.pagination?.prevCursor ?? prev.prevCursor,
        }));
      } else {
        // No items yet, just do a fresh load
        await loadItems();
      }
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoadingMore: false,
        error: err instanceof Error ? err.message : 'Failed to refresh',
      }));
    }
  }, [status, folderId, state.items, loadItems]);

  /**
   * Update a single item in the list (for optimistic updates)
   */
  const updateItem = useCallback((itemId: string, updates: Partial<SaveItem>) => {
    setState(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === itemId ? { ...item, ...updates } : item
      ),
    }));
  }, []);

  /**
   * Remove an item from the list
   */
  const removeItem = useCallback((itemId: string) => {
    setState(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== itemId),
    }));
  }, []);

  /**
   * Add a new item to the list
   */
  const addItem = useCallback((item: SaveItem, atBeginning = true) => {
    setState(prev => ({
      ...prev,
      items: atBeginning ? [item, ...prev.items] : [...prev.items, item],
    }));
  }, []);

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
