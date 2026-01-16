import { Platform } from 'react-native';

// Conditional import for SecureStore (not available on web)
let SecureStore: typeof import('expo-secure-store') | null = null;
if (Platform.OS !== 'web') {
  try {
    SecureStore = require('expo-secure-store');
  } catch {
    // SecureStore not available
  }
}
import { Config } from '../config';
import {
  SaveItem,
  SaveItemStatus,
  Folder,
  AuthResponse,
  ItemsResponse,
  FoldersResponse,
  UploadURLResponse,
} from '../types';

// API Error class
export class APIError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// Token storage keys
const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

// Platform-specific storage wrapper
// On web, use localStorage; on native, use SecureStore
const TokenStorage = {
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    } else if (SecureStore) {
      await SecureStore.setItemAsync(key, value);
    }
  },

  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    } else if (SecureStore) {
      return await SecureStore.getItemAsync(key);
    }
    return null;
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
    } else if (SecureStore) {
      await SecureStore.deleteItemAsync(key);
    }
  },
};

class APIService {
  private baseURL: string;
  private accessToken: string | null = null;

  constructor() {
    this.baseURL = Config.apiBaseURL;
    if (__DEV__) {
      console.log('API Service initialized with baseURL:', this.baseURL);
    }
  }

  // Initialize - load stored token
  async init(): Promise<boolean> {
    try {
      this.accessToken = await TokenStorage.getItem(ACCESS_TOKEN_KEY);
      return !!this.accessToken;
    } catch {
      return false;
    }
  }

  // Check if authenticated
  get isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  // Set tokens
  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    this.accessToken = accessToken;
    await TokenStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    await TokenStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }

  // Clear tokens
  async clearTokens(): Promise<void> {
    this.accessToken = null;
    await TokenStorage.removeItem(ACCESS_TOKEN_KEY);
    await TokenStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  // Make request helper
  private async request<T>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      queryParams?: Record<string, string | number | boolean | undefined>;
    } = {}
  ): Promise<T> {
    const { method = 'GET', body, queryParams } = options;

    // Build URL with query params
    let url = `${this.baseURL}${path}`;
    if (queryParams) {
      const params = new URLSearchParams();
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      });
      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    // Make request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Config.apiTimeoutMs);

    try {
      if (__DEV__) {
        console.log(`[API] ${method} ${url}`, body ? { body } : '');
      }
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle response
      if (!response.ok) {
        if (response.status === 401) {
          await this.clearTokens();
          throw new APIError('UNAUTHORIZED', 'Please sign in again', 401);
        }

        let message = `Server error (${response.status})`;
        try {
          const errorData = await response.json();
          message = errorData.message || message;
        } catch {
          // Ignore JSON parse error
        }

        throw new APIError('SERVER_ERROR', message, response.status);
      }

      // Handle empty responses
      const text = await response.text();
      if (!text) {
        return {} as T;
      }

      return JSON.parse(text) as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof APIError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new APIError('TIMEOUT', 'Request timed out');
        }
        // Provide more helpful error message for "Failed to fetch"
        if (error.message === 'Failed to fetch' || error.message.includes('fetch')) {
          const helpfulMessage = `Cannot connect to server at ${this.baseURL}. Please ensure the backend server is running on port 3000.`;
          throw new APIError('NETWORK_ERROR', helpfulMessage);
        }
        throw new APIError('NETWORK_ERROR', `Network error: ${error.message}`);
      }

      throw new APIError('UNKNOWN', 'An unknown error occurred');
    }
  }

  // ============ Auth Endpoints ============

  async signUp(email: string, password: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: { email, password },
    });
    await this.setTokens(response.accessToken, response.refreshToken);
    return response;
  }

  async signIn(email: string, password: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/signin', {
      method: 'POST',
      body: { email, password },
    });
    await this.setTokens(response.accessToken, response.refreshToken);
    return response;
  }

  async signOut(): Promise<void> {
    await this.clearTokens();
  }

  // ============ Save Items Endpoints ============

  async createSaveItem(sourceURL: string, rawSharedText?: string): Promise<SaveItem> {
    return this.request<SaveItem>('/items', {
      method: 'POST',
      body: { sourceURL, rawSharedText },
    });
  }

  async getItems(options?: {
    status?: SaveItemStatus;
    folderId?: string;
    limit?: number;
    offset?: number;
  }): Promise<SaveItem[]> {
    const response = await this.request<ItemsResponse>('/items', {
      queryParams: {
        status: options?.status,
        folderId: options?.folderId,
        limit: options?.limit ?? 50,
        offset: options?.offset ?? 0,
      },
    });
    return response.items;
  }

  async getItem(id: string): Promise<SaveItem> {
    return this.request<SaveItem>(`/items/${id}`);
  }

  async moveItemToFolder(itemId: string, folderId: string | null): Promise<SaveItem> {
    return this.request<SaveItem>(`/items/${itemId}/moveFolder`, {
      method: 'POST',
      body: { folderId },
    });
  }

  async deleteItem(id: string): Promise<void> {
    await this.request(`/items/${id}`, { method: 'DELETE' });
  }

  async getUploadURL(itemId: string): Promise<UploadURLResponse> {
    return this.request<UploadURLResponse>(`/items/${itemId}/uploadUrl`, {
      method: 'POST',
    });
  }

  async completeUpload(itemId: string): Promise<SaveItem> {
    return this.request<SaveItem>(`/items/${itemId}/completeUpload`, {
      method: 'POST',
    });
  }

  // ============ Folders Endpoints ============

  async getFolders(): Promise<Folder[]> {
    const response = await this.request<FoldersResponse>('/folders');
    return response.folders;
  }

  async createFolder(name: string, parentId?: string, iconName?: string): Promise<Folder> {
    return this.request<Folder>('/folders', {
      method: 'POST',
      body: { name, parentId, iconName },
    });
  }

  async updateFolder(id: string, updates: { name?: string; iconName?: string }): Promise<Folder> {
    return this.request<Folder>(`/folders/${id}`, {
      method: 'PATCH',
      body: updates,
    });
  }

  async deleteFolder(id: string): Promise<void> {
    await this.request(`/folders/${id}`, { method: 'DELETE' });
  }

  // ============ Search Endpoint ============

  async search(query: string, semantic = true): Promise<SaveItem[]> {
    const response = await this.request<ItemsResponse>('/search', {
      queryParams: { q: query, semantic },
    });
    return response.items;
  }
}

// Export singleton instance
export const apiService = new APIService();

