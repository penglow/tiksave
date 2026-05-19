/** Focused unit tests for sanitize edge cases. */

import { describe, it, expect } from 'bun:test';
import {
  escapeHtml,
  sanitizeString,
  sanitizeTikTokUrl,
  sanitizeTikTokImageUrl,
  sanitizeObject,
} from '../../utils/sanitize';

describe('sanitize.unit', () => {
  it('escapeHtml handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('sanitizeString returns empty for nullish', () => {
    expect(sanitizeString(null)).toBe('');
    expect(sanitizeString(undefined)).toBe('');
  });

  it('sanitizeTikTokUrl rejects credentials in URL', () => {
    expect(sanitizeTikTokUrl('https://user:pass@www.tiktok.com/@x/video/1')).toBeNull();
  });

  it('sanitizeTikTokImageUrl allows tiktok static path', () => {
    const u = 'https://www.tiktok.com/obj/cover/abc.jpg';
    expect(sanitizeTikTokImageUrl(u)).toBeTruthy();
  });

  it('sanitizeObject respects maxDepth', () => {
    let deep: Record<string, unknown> = { v: 'ok' };
    for (let i = 0; i < 15; i++) {
      deep = { nested: deep };
    }
    const out = sanitizeObject({ deep }, { maxDepth: 3 });
    expect(out).toBeTruthy();
  });
});
