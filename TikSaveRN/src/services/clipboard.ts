/**
 * Clipboard monitoring and TikTok URL detection for share-to-import flows.
 * Persists last-seen content to avoid duplicate prompts.
 */

import { AppState, AppStateStatus } from 'react-native';
import * as ExpoClipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_CLIPBOARD_KEY = 'lastClipboardContent';
const CLIPBOARD_URLS_KEY = 'detectedClipboardUrls';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// TikTok URL patterns
const TIKTOK_PATTERNS = [
  /https?:\/\/(?:www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/gi,
  /https?:\/\/(?:www\.)?tiktok\.com\/t\/[\w]+/gi,
  /https?:\/\/vm\.tiktok\.com\/[\w]+/gi,
  /https?:\/\/(?:www\.)?tiktok\.com\/[\w@]+\/[\w]+/gi,
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClipboardDetectionResult {
  hasUrls: boolean;
  urls: string[];
  isNew: boolean; // Whether this is new content we haven't seen before
}

// ---------------------------------------------------------------------------
// URL extraction
// ---------------------------------------------------------------------------

/**
 * Extract all TikTok URLs from text.
 *
 * @param text - Clipboard or shared text content.
 */
export function extractTikTokUrls(text: string): string[] {
  if (!text || typeof text !== 'string') return [];

  const urls: string[] = [];

  for (const pattern of TIKTOK_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    const matches = text.match(pattern);
    if (matches) {
      urls.push(...matches);
    }
  }

  // Deduplicate URLs
  return [...new Set(urls)];
}

/**
 * Check if a single string is a valid TikTok URL.
 *
 * @param url - Candidate URL string.
 */
export function isTikTokUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.includes('tiktok.com') || url.includes('vm.tiktok');
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

/** Get the last checked clipboard content from AsyncStorage. */
async function getLastClipboardContent(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_CLIPBOARD_KEY);
  } catch {
    return null;
  }
}

/** Save the current clipboard content as "seen". */
async function setLastClipboardContent(content: string): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_CLIPBOARD_KEY, content);
  } catch {
    // Ignore storage errors
  }
}

// ---------------------------------------------------------------------------
// Clipboard checks
// ---------------------------------------------------------------------------

/**
 * Check clipboard for TikTok URLs.
 * Returns detected URLs and whether this is new content.
 */
export async function checkClipboardForUrls(): Promise<ClipboardDetectionResult> {
  try {
    // Check if clipboard has text
    const hasText = await ExpoClipboard.hasStringAsync();
    if (!hasText) {
      return { hasUrls: false, urls: [], isNew: false };
    }

    // Get clipboard content
    const content = await ExpoClipboard.getStringAsync();
    if (!content) {
      return { hasUrls: false, urls: [], isNew: false };
    }

    // Check if this is new content
    const lastContent = await getLastClipboardContent();
    const isNew = content !== lastContent;

    // Extract TikTok URLs
    const urls = extractTikTokUrls(content);

    return {
      hasUrls: urls.length > 0,
      urls,
      isNew,
    };
  } catch (error) {
    console.error('Failed to check clipboard:', error);
    return { hasUrls: false, urls: [], isNew: false };
  }
}

/**
 * Mark the current clipboard content as processed.
 * Call after the user has seen or acted on the detected URLs.
 */
export async function markClipboardProcessed(): Promise<void> {
  try {
    const hasText = await ExpoClipboard.hasStringAsync();
    if (hasText) {
      const content = await ExpoClipboard.getStringAsync();
      if (content) {
        await setLastClipboardContent(content);
      }
    }
  } catch (error) {
    console.error('Failed to mark clipboard as processed:', error);
  }
}

/**
 * Clear stored clipboard state.
 * Useful for testing or when the user wants to re-check the same URLs.
 */
export async function clearClipboardState(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LAST_CLIPBOARD_KEY);
    await AsyncStorage.removeItem(CLIPBOARD_URLS_KEY);
  } catch {
    // Ignore errors
  }
}

// ---------------------------------------------------------------------------
// ClipboardService
// ---------------------------------------------------------------------------

type ClipboardCallback = (result: ClipboardDetectionResult) => void;

/** Singleton that monitors app foreground and notifies listeners of new TikTok URLs. */
class ClipboardService {
  private listeners: Set<ClipboardCallback> = new Set();
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
  private lastAppState: AppStateStatus = AppState.currentState;
  private isMonitoring = false;

  /**
   * Start monitoring clipboard for TikTok URLs
   * Checks clipboard when app comes to foreground
   */
  startMonitoring() {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.lastAppState = AppState.currentState;

    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);

    // Also check immediately if app is active
    if (AppState.currentState === 'active') {
      this.checkAndNotify();
    }
  }

  /**
   * Stop monitoring clipboard
   */
  stopMonitoring() {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }

  /**
   * Add a listener for clipboard URL detection
   */
  addListener(callback: ClipboardCallback): () => void {
    this.listeners.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Manually trigger a clipboard check
   */
  async checkNow(): Promise<ClipboardDetectionResult> {
    return checkClipboardForUrls();
  }

  private handleAppStateChange = async (nextAppState: AppStateStatus) => {
    // Check clipboard when app comes to foreground
    if (this.lastAppState.match(/inactive|background/) && nextAppState === 'active') {
      await this.checkAndNotify();
    }

    this.lastAppState = nextAppState;
  };

  private async checkAndNotify() {
    const result = await checkClipboardForUrls();

    // Only notify if we found new URLs
    if (result.hasUrls && result.isNew) {
      this.listeners.forEach((callback) => {
        try {
          callback(result);
        } catch (error) {
          console.error('Clipboard listener error:', error);
        }
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/** Shared clipboard monitoring service instance. */
export const clipboardService = new ClipboardService();

export default clipboardService;
