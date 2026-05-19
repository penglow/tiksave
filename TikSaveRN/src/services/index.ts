/**
 * API and platform services barrel.
 */

export { APIError, apiService } from './api';
export {
  checkClipboardForUrls,
  clearClipboardState,
  clipboardService,
  extractTikTokUrls,
  isTikTokUrl,
  markClipboardProcessed,
  type ClipboardDetectionResult,
} from './clipboard';
