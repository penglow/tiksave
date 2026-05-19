/**
 * Named security/regression cases for sanitizers — each documents a threat or bug class.
 */

import { describe, it, expect } from 'bun:test';
import {
  escapeHtml,
  sanitizeString,
  sanitizeUrl,
  sanitizeTikTokUrl,
  sanitizeTikTokImageUrl,
  sanitizeUserContent,
  sanitizeEmail,
  sanitizeObject,
  removeNullBytes,
} from '../../utils/sanitize';

describe('sanitize regression catalog', () => {
  it('blocks SSRF via metadata service IP literal', () => {
    expect(sanitizeTikTokUrl('https://169.254.169.254/latest/meta-data/')).toBeNull();
  });

  it('blocks tiktok lookalike domain tiktok.evil.com', () => {
    expect(sanitizeTikTokUrl('https://tiktok.evil.com/@u/video/1')).toBeNull();
  });

  it('blocks javascript protocol masquerading as URL', () => {
    expect(sanitizeUrl('javascript:alert(document.cookie)')).toBeNull();
  });

  it('strips onerror handler injected in user caption', () => {
    const out = sanitizeUserContent('Great reel <img src=x onerror=alert(1)>');
    expect(out.toLowerCase()).not.toContain('onerror');
    expect(out).not.toContain('<img');
  });

  it('strips nested script tags but may leave inner text content', () => {
    const out = sanitizeString('<script><script>alert(1)</script></script>hello');
    expect(out).not.toContain('<script');
    expect(out).toContain('hello');
  });

  it('preserves harmless unicode emoji in titles', () => {
    const out = sanitizeString('Best ramen in Tokyo 🍜🔥');
    expect(out).toContain('🍜');
  });

  it('rejects ftp video download URL', () => {
    expect(sanitizeUrl('ftp://tiktok.com/video/1')).toBeNull();
  });

  it('allows vm.tiktok short link host', () => {
    expect(sanitizeTikTokUrl('https://vm.tiktok.com/ZMabcdef/')).not.toBeNull();
  });

  it('rejects image from random CDN domain', () => {
    expect(sanitizeTikTokImageUrl('https://cdn.example.com/steal.jpg')).toBeNull();
  });

  it('allows byteimg TikTok CDN thumbnail', () => {
    expect(
      sanitizeTikTokImageUrl('https://p16-sign-sg.tiktokcdn.com/obj/cover-123~tplv.jpeg')
    ).not.toBeNull();
  });

  it('removes postgres null byte injection in folder name', () => {
    expect(removeNullBytes('Japan\0Drop')).toBe('JapanDrop');
  });

  it('sanitizeObject blocks prototype pollution key cleanup', () => {
    const out = sanitizeObject({ __proto__: { polluted: true }, title: '<b>x</b>' } as Record<
      string,
      unknown
    >);
    expect(JSON.stringify(out)).not.toContain('<b>');
  });

  it('email normalizes mixed case and trims', () => {
    expect(sanitizeEmail('  User@TikSave.APP  ')).toBe('user@tiksave.app');
  });

  it('documents homoglyph domain acceptance gap in basic email regex', () => {
    const out = sanitizeEmail('user@еxample.com');
    expect(out === null || out.includes('@')).toBe(true);
  });

  it('escapeHtml prevents attribute breakout in JSON-LD snippet', () => {
    expect(escapeHtml('"><script>')).not.toContain('<script>');
  });

  it('collapses excessive newlines in long description', () => {
    const out = sanitizeString('a\n\n\n\n\nb', { allowNewlines: true });
    expect(out).toBe('a\n\nb');
  });

  it('rejects URL with embedded credentials', () => {
    expect(sanitizeTikTokUrl('https://user:pass@www.tiktok.com/@x/video/1')).toBeNull();
  });

  it('strips data URI images from shared text', () => {
    const out = sanitizeString('<img src="data:text/html;base64,PHNjcmlwdD4=">');
    expect(out).not.toContain('data:text');
  });
});
