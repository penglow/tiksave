import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserSettings, DEFAULT_USER_SETTINGS } from '../types';

type TabName = 'library' | 'add' | 'search' | 'settings';

interface AppState {
  selectedTab: TabName;
  unreadInboxCount: number;
  isProcessing: boolean;
  recentSearches: string[];
  userSettings: UserSettings;
  pendingShareUrl: string | null;

  // Actions
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

const RECENT_SEARCHES_KEY = 'recentSearches';
const USER_SETTINGS_KEY = 'userSettings';

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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e4b12369-f4da-44c9-b8ec-020b4285b184',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'appStore.ts:93',message:'updateUserSettings called',data:{updates,currentTheme:get().userSettings.theme},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    const current = get().userSettings;
    const updated = { ...current, ...updates };
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e4b12369-f4da-44c9-b8ec-020b4285b184',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'appStore.ts:96',message:'Before set() call',data:{updatedTheme:updated.theme,currentTheme:current.theme},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    set({ userSettings: updated });
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e4b12369-f4da-44c9-b8ec-020b4285b184',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'appStore.ts:97',message:'After set() call',data:{updatedTheme:updated.theme},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    try {
      await AsyncStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(updated));
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/e4b12369-f4da-44c9-b8ec-020b4285b184',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'appStore.ts:100',message:'AsyncStorage save success',data:{savedTheme:updated.theme},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/e4b12369-f4da-44c9-b8ec-020b4285b184',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'appStore.ts:102',message:'AsyncStorage save failed',data:{error:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      // Ignore storage errors
    }
  },
}));

