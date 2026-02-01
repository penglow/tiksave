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
  retryAfter?: number; // seconds until retry is allowed (for rate limiting)
  
  constructor(
    public code: string,
    message: string,
    public statusCode?: number,
    retryAfter?: number
  ) {
    super(message);
    this.name = 'APIError';
    this.retryAfter = retryAfter;
  }
}

// Request deduplication - prevents duplicate concurrent requests
const pendingRequests = new Map<string, Promise<any>>();

function serializeQueryParams(queryParams?: Record<string, string | number | boolean | undefined>): string {
  if (!queryParams) return '';
  const entries = Object.entries(queryParams)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => [key, String(value)] as [string, string])
    .sort(([a], [b]) => a.localeCompare(b));
  return new URLSearchParams(entries).toString();
}

function getRequestKey(
  method: string,
  path: string,
  body?: unknown,
  queryParams?: Record<string, string | number | boolean | undefined>
): string {
  const queryString = serializeQueryParams(queryParams);
  return `${method}:${path}?${queryString}:${body ? JSON.stringify(body) : ''}`;
}

// Token storage keys
const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

// Platform-specific storage wrapper
// On web, use localStorage; on native, use SecureStore
// Falls back to in-memory storage if neither is available
let inMemoryStorage: Record<string, string> = {};
let secureStoreAvailable: boolean | null = null;

const TokenStorage = {
  async isSecureStoreAvailable(): Promise<boolean> {
    if (secureStoreAvailable !== null) return secureStoreAvailable;
    
    if (Platform.OS === 'web') {
      secureStoreAvailable = false;
      return false;
    }
    
    if (!SecureStore) {
      secureStoreAvailable = false;
      console.warn('⚠️ SecureStore not available, using in-memory storage (tokens will not persist across app restarts)');
      return false;
    }
    
    // Test if SecureStore actually works
    try {
      const testKey = '__secure_store_test__';
      await SecureStore.setItemAsync(testKey, 'test');
      await SecureStore.deleteItemAsync(testKey);
      secureStoreAvailable = true;
      return true;
    } catch (error) {
      console.warn('⚠️ SecureStore test failed, using in-memory storage:', error);
      secureStoreAvailable = false;
      return false;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        localStorage.setItem(key, value);
      } catch (error) {
        console.warn('localStorage.setItem failed, using in-memory storage:', error);
        inMemoryStorage[key] = value;
      }
      return;
    }
    
    const useSecureStore = await this.isSecureStoreAvailable();
    if (useSecureStore && SecureStore) {
      try {
        await SecureStore.setItemAsync(key, value);
        return;
      } catch (error) {
        console.warn('SecureStore.setItemAsync failed, falling back to in-memory:', error);
      }
    }
    
    // Fallback to in-memory storage
    inMemoryStorage[key] = value;
  },

  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try {
        return localStorage.getItem(key);
      } catch (error) {
        console.warn('localStorage.getItem failed:', error);
        return inMemoryStorage[key] ?? null;
      }
    }
    
    const useSecureStore = await this.isSecureStoreAvailable();
    if (useSecureStore && SecureStore) {
      try {
        return await SecureStore.getItemAsync(key);
      } catch (error) {
        console.warn('SecureStore.getItemAsync failed:', error);
      }
    }
    
    // Fallback to in-memory storage
    return inMemoryStorage[key] ?? null;
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.warn('localStorage.removeItem failed:', error);
      }
      delete inMemoryStorage[key];
      return;
    }
    
    const useSecureStore = await this.isSecureStoreAvailable();
    if (useSecureStore && SecureStore) {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch (error) {
        console.warn('SecureStore.deleteItemAsync failed:', error);
      }
    }
    
    // Also clear from in-memory storage
    delete inMemoryStorage[key];
  },
};

class APIService {
  private baseURL: string;
  private accessToken: string | null = null;
  private isRefreshing: boolean = false;
  private refreshPromise: Promise<boolean> | null = null;

  constructor() {
    this.baseURL = Config.apiBaseURL;
    if (__DEV__) {
      console.log('API Service initialized with baseURL:', this.baseURL);
    }
  }

  // Attempt to refresh the access token using the refresh token
  private async refreshAccessToken(): Promise<boolean> {
    // If already refreshing, wait for that to complete
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = (async () => {
      try {
        const refreshToken = await TokenStorage.getItem(REFRESH_TOKEN_KEY);
        if (!refreshToken) {
          return false;
        }

        const response = await fetch(`${this.baseURL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) {
          return false;
        }

        const data = await response.json();
        if (data.accessToken && data.refreshToken) {
          await this.setTokens(data.accessToken, data.refreshToken);
          return true;
        }
        return false;
      } catch (error) {
        console.warn('Token refresh failed:', error);
        return false;
      } finally {
        this.isRefreshing = false;
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
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

  // Make request helper with retry logic and deduplication
  private async request<T>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      queryParams?: Record<string, string | number | boolean | undefined>;
      skipDedup?: boolean; // Skip deduplication for certain requests
      retryCount?: number; // Current retry attempt
    } = {}
  ): Promise<T> {
    const { method = 'GET', body, queryParams, skipDedup = false, retryCount = 0 } = options;
    const maxRetries = 3;

    // Request deduplication for GET requests
    const requestKey = getRequestKey(method, path, body, queryParams);
    if (!skipDedup && method === 'GET' && pendingRequests.has(requestKey)) {
      if (__DEV__) {
        console.log(`[API] Deduplicating request: ${method} ${path}`);
      }
      return pendingRequests.get(requestKey) as Promise<T>;
    }

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

    // Create the request promise
    const requestPromise = (async (): Promise<T> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), Config.apiTimeoutMs);

      try {
        if (__DEV__) {
          console.log(`[API] ${method} ${url}${retryCount > 0 ? ` (retry ${retryCount})` : ''}`, body ? { body } : '');
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
          // Try to read error message from response body
          let errorMessage = `Server error (${response.status})`;
          let retryAfter: number | undefined;
          
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch {
            // Ignore JSON parse error
          }

          // Handle rate limiting (429)
          if (response.status === 429) {
            const retryAfterHeader = response.headers.get('Retry-After');
            retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 60;
            const waitMessage = retryAfter 
              ? `Too many requests. Please wait ${retryAfter} seconds before trying again.`
              : 'Too many requests. Please try again later.';
            throw new APIError('RATE_LIMITED', waitMessage, 429, retryAfter);
          }

          if (response.status === 401) {
            // For login/signup endpoints, use the actual error message from backend
            const isAuthEndpoint = path === '/auth/signin' || path === '/auth/signup' || path === '/auth/refresh';
            if (isAuthEndpoint) {
              throw new APIError('UNAUTHORIZED', errorMessage, 401);
            }
            
            // Try to refresh the token
            const refreshed = await this.refreshAccessToken();
            if (refreshed) {
              // Retry the original request with new token
              return this.request<T>(path, { ...options, skipDedup: true, retryCount: retryCount + 1 });
            }
            
            // Refresh failed, clear tokens and require re-login
            await this.clearTokens();
            throw new APIError('UNAUTHORIZED', 'Session expired. Please sign in again.', 401);
          }

          // Retry on server errors (5xx) with exponential backoff
          if (response.status >= 500 && retryCount < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.request<T>(path, { ...options, skipDedup: true, retryCount: retryCount + 1 });
          }

          throw new APIError('SERVER_ERROR', errorMessage, response.status);
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
          
          // Retry on network errors with exponential backoff
          if ((error.message === 'Failed to fetch' || error.message.includes('fetch') || 
               error.message.includes('network')) && retryCount < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
            if (__DEV__) {
              console.log(`[API] Network error, retrying in ${delay}ms...`);
            }
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.request<T>(path, { ...options, skipDedup: true, retryCount: retryCount + 1 });
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
    })();

    // Store in pending requests for deduplication
    if (!skipDedup && method === 'GET') {
      pendingRequests.set(requestKey, requestPromise);
      requestPromise.finally(() => {
        pendingRequests.delete(requestKey);
      });
    }

    return requestPromise;
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

  // Batch import multiple URLs
  async batchCreateSaveItems(
    urls: string[],
    options?: { skipDuplicates?: boolean; autoOrganize?: boolean }
  ): Promise<{
    batchId: string;
    total: number;
    queued: number;
    duplicates: number;
    errors: number;
    items: Array<{
      id: string;
      url: string;
      status: 'queued' | 'duplicate' | 'error';
      error?: string;
    }>;
  }> {
    return this.request('/items/batch', {
      method: 'POST',
      body: {
        urls,
        options: {
          skipDuplicates: options?.skipDuplicates ?? true,
          autoOrganize: options?.autoOrganize ?? true,
        },
      },
    });
  }

  // Legacy offset-based pagination (for backward compatibility)
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

  // Cursor-based pagination (more efficient for large datasets)
  async getItemsPaginated(options?: {
    status?: SaveItemStatus;
    folderId?: string;
    cursor?: string;
    limit?: number;
    direction?: 'next' | 'prev';
  }): Promise<ItemsResponse> {
    return this.request<ItemsResponse>('/items/paginated', {
      queryParams: {
        status: options?.status,
        folderId: options?.folderId,
        cursor: options?.cursor,
        limit: options?.limit ?? 20,
        direction: options?.direction ?? 'next',
      },
    });
  }

  // Map markers (one per location)
  async getMapItems(options?: { limit?: number; offset?: number }): Promise<SaveItem[]> {
    const response = await this.request<ItemsResponse>('/items/map', {
      queryParams: {
        limit: options?.limit ?? 500,
        offset: options?.offset ?? 0,
      },
    });
    return response.items;
  }

  async getItem(id: string): Promise<SaveItem> {
    return this.request<SaveItem>(`/items/${id}`);
  }

  // Get processing progress for an item (real-time status updates)
  async getItemProgress(id: string): Promise<{
    id: string;
    status: string;
    processing: {
      stage: string;
      progress: number;
      message: string;
      emoji: string;
    };
  }> {
    return this.request(`/items/${id}/progress`, { skipDedup: true });
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

