import { create } from 'zustand';
import { SaveItem } from '../types';

export interface CachedPaginationState {
  items: SaveItem[];
  hasMore: boolean;
  nextCursor: string | null;
  prevCursor: string | null;
  updatedAt: number;
}

interface PaginationCacheStore {
  pages: Record<string, CachedPaginationState>;
  getPage: (key: string) => CachedPaginationState | null;
  setPage: (key: string, state: CachedPaginationState) => void;
  clearPage: (key: string) => void;
  clearAll: () => void;
}

export const usePaginationCacheStore = create<PaginationCacheStore>((set, get) => ({
  pages: {},

  getPage: (key) => get().pages[key] || null,

  setPage: (key, state) =>
    set((prev) => ({
      pages: {
        ...prev.pages,
        [key]: state,
      },
    })),

  clearPage: (key) =>
    set((prev) => {
      const next = { ...prev.pages };
      delete next[key];
      return { pages: next };
    }),

  clearAll: () => set({ pages: {} }),
}));
