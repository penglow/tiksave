import * as SecureStore from 'expo-secure-store';
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

class APIService {
  private baseURL: string;
  private accessToken: string | null = null;

  constructor() {
    this.baseURL = Config.apiBaseURL;
  }

  // Initialize - load stored token
  async init(): Promise<boolean> {
    try {
      this.accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
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
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  }

  // Clear tokens
  async clearTokens(): Promise<void> {
    this.accessToken = null;
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
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

  async moveItemToFolder(itemId: string, folderId: string): Promise<SaveItem> {
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

