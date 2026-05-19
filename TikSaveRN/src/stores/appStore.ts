/**
 * Global app UI state: tab selection, recent searches, user settings, and share intents.
 * Persists recent searches and settings to AsyncStorage.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserSettings, DEFAULT_USER_SETTINGS } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabName = 'library' | 'add' | 'search' | 'settings';

interface AppState {
  selectedTab: TabName;
  unreadInboxCount: number;
  isProcessing: boolean;
  recentSearches: string[];
  userSettings: UserSettings;
  pendingShareUrl: string | null;

  setSelectedTab: (tab: TabName) => void;
  setUnreadInboxCount: (count: number) => void;
  setIsProcessing: (processing: boolean) => void;
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
  loadRecentSearches: () => Promise<void>;
  loadUserSettings: () => Promise<void>;
  updateUserSettings: (settings: Partial<UserSettings>) => Promise<void>;
  setPendingShareUrl: (url: string) => void;
  clearPendingShare: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RECENT_SEARCHES_KEY = 'recentSearches';
const USER_SETTINGS_KEY = 'userSettings';

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/** Zustand store for cross-screen app preferences and ephemeral UI state. */
export const useAppStore = create<AppState>((set, get) => ({
  selectedTab: 'library',
  unreadInboxCount: 0,
  isProcessing: false,
  recentSearches: [],
  userSettings: DEFAULT_USER_SETTINGS,
  pendingShareUrl: null,

  setSelectedTab: (tab) => set({ selectedTab: tab }),

  setPendingShareUrl: (url) => set({ pendingShareUrl: url }),

  clearPendingShare: () => set({ pendingShareUrl: null }),

  setUnreadInboxCount: (count) => set({ unreadInboxCount: count }),

  setIsProcessing: (processing) => set({ isProcessing: processing }),

  addRecentSearch: async (query) => {
    const current = get().recentSearches;
    const filtered = current.filter((s) => s.toLowerCase() !== query.toLowerCase());
    const updated = [query, ...filtered].slice(0, 10);
    set({ recentSearches: updated });

    try {
      await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage errors
    }
  },

  clearRecentSearches: async () => {
    set({ recentSearches: [] });
    try {
      await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      // Ignore storage errors
    }
  },

  loadRecentSearches: async () => {
    try {
      const stored = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        set({ recentSearches: JSON.parse(stored) });
      }
    } catch {
      // Ignore storage errors
    }
  },

  loadUserSettings: async () => {
    try {
      const stored = await AsyncStorage.getItem(USER_SETTINGS_KEY);
      if (stored) {
        set({ userSettings: { ...DEFAULT_USER_SETTINGS, ...JSON.parse(stored) } });
      }
    } catch {
      // Ignore storage errors
    }
  },

  updateUserSettings: async (updates) => {
    const current = get().userSettings;
    const updated = { ...current, ...updates };

    set({ userSettings: updated });

    try {
      await AsyncStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage errors
    }
  },
}));
