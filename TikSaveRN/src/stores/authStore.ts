/**
 * Authentication state and sign-in/sign-up/sign-out actions backed by the API service.
 */

import { create } from 'zustand';
import { apiService, APIError } from '../services/api';
import { User } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  user: User | null;
  error: string | null;

  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/** Zustand store for session lifecycle and auth errors. */
export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  user: null,
  error: null,

  initialize: async () => {
    try {
      const hasToken = await apiService.init();

      set({ isAuthenticated: hasToken, isInitialized: true });
    } catch {
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
