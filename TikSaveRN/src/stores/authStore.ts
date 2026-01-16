import { create } from 'zustand';
import { apiService, APIError } from '../services/api';
import { User } from '../types';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  user: User | null;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  user: null,
  error: null,

  initialize: async () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e4b12369-f4da-44c9-b8ec-020b4285b184',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'authStore.ts:27',message:'initialize called',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'web-debug',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    try {
      const hasToken = await apiService.init();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/e4b12369-f4da-44c9-b8ec-020b4285b184',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'authStore.ts:30',message:'apiService.init completed',data:{hasToken},timestamp:Date.now(),sessionId:'debug-session',runId:'web-debug',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      set({ isAuthenticated: hasToken, isInitialized: true });
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/e4b12369-f4da-44c9-b8ec-020b4285b184',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'authStore.ts:33',message:'initialize error',data:{error:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'web-debug',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      set({ isAuthenticated: false, isInitialized: true });
    }
  },

  signIn: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiService.signIn(email, password);
      set({ isAuthenticated: true, user: response.user, isLoading: false });
      return true;
    } catch (error) {
      const message = error instanceof APIError ? error.message : 'Sign in failed';
      set({ error: message, isLoading: false });
      return false;
    }
  },

  signUp: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiService.signUp(email, password);
      set({ isAuthenticated: true, user: response.user, isLoading: false });
      return true;
    } catch (error) {
      const message = error instanceof APIError ? error.message : 'Sign up failed';
      set({ error: message, isLoading: false });
      return false;
    }
  },

  signOut: async () => {
    await apiService.signOut();
    set({ isAuthenticated: false, user: null });
  },

  clearError: () => set({ error: null }),
}));

