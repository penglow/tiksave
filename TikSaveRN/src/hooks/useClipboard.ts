import { useState, useEffect, useCallback } from 'react';
import { AppState } from 'react-native';
import {
  clipboardService,
  checkClipboardForUrls,
  markClipboardProcessed,
  ClipboardDetectionResult,
} from '../services/clipboard';

interface UseClipboardOptions {
  /** Whether to automatically check on app foreground */
  autoCheck?: boolean;
  /** Whether to only notify for new URLs (not seen before) */
  onlyNew?: boolean;
}

interface UseClipboardReturn {
  /** Detected TikTok URLs from clipboard */
  urls: string[];
  /** Whether we have detected URLs */
  hasUrls: boolean;
  /** Whether these are new URLs we haven't processed */
  isNew: boolean;
  /** Manually check clipboard */
  checkClipboard: () => Promise<void>;
  /** Mark current URLs as processed (won't show again) */
  dismissUrls: () => Promise<void>;
  /** Clear the detected URLs from state */
  clearUrls: () => void;
}

/**
 * Hook to detect TikTok URLs from clipboard
 * Automatically checks when app comes to foreground
 */
export function useClipboard(options: UseClipboardOptions = {}): UseClipboardReturn {
  const { autoCheck = true, onlyNew = true } = options;
  
  const [detection, setDetection] = useState<ClipboardDetectionResult>({
    hasUrls: false,
    urls: [],
    isNew: false,
  });

  const checkClipboard = useCallback(async () => {
    const result = await checkClipboardForUrls();
    
    // Only update state if we should show this
    if (!onlyNew || result.isNew) {
      setDetection(result);
    }
  }, [onlyNew]);

  const dismissUrls = useCallback(async () => {
    await markClipboardProcessed();
    setDetection({ hasUrls: false, urls: [], isNew: false });
  }, []);

  const clearUrls = useCallback(() => {
    setDetection({ hasUrls: false, urls: [], isNew: false });
  }, []);

  useEffect(() => {
    if (!autoCheck) return;

    // Check on mount if app is active
    if (AppState.currentState === 'active') {
      checkClipboard();
    }

    // Subscribe to clipboard service for foreground checks
    const unsubscribe = clipboardService.addListener((result) => {
      if (!onlyNew || result.isNew) {
        setDetection(result);
      }
    });

    // Start monitoring
    clipboardService.startMonitoring();

    return () => {
      unsubscribe();
    };
  }, [autoCheck, onlyNew, checkClipboard]);

  return {
    urls: detection.urls,
    hasUrls: detection.hasUrls,
    isNew: detection.isNew,
    checkClipboard,
    dismissUrls,
    clearUrls,
  };
}

export default useClipboard;
