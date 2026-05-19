/**
 * Security matrix — XSS, HTML injection, null bytes, command/path tricks.
 */

import { describe, it, expect } from 'bun:test';
import {
  escapeHtml,
  stripHtml,
  sanitizeString,
  sanitizeUserContent,
  sanitizeUsername,
  removeNullBytes,
  sanitizeObject,
} from '../../utils/sanitize';
import {
  buildSecurityCatalog,
  generateXssPayloads,
  generateNullBytePayloads,
  generatePathTraversalStrings,
  generateCommandInjectionStrings,
  generateSqlInjectionStrings,
} from '../fixtures/securityPayloads';

const catalog = buildSecurityCatalog();

function assertNoActiveHtml(output: string): void {
  expect(output.toLowerCase()).not.toMatch(/<script\b/);
  expect(output.toLowerCase()).not.toMatch(/<iframe\b/);
  expect(output.toLowerCase()).not.toMatch(/<svg\b/);
  expect(output.toLowerCase()).not.toMatch(/onerror\s*=/);
  expect(output.toLowerCase()).not.toMatch(/onload\s*=/);
  expect(output.toLowerCase()).not.toMatch(/onclick\s*=/);
  // javascript: in plain text is acceptable; must not appear inside markup
  if (output.includes('<')) {
    expect(output.toLowerCase()).not.toMatch(/javascript:/);
  }
}

describe('security.xss — sanitizeString neutralizes payloads', () => {
  for (const c of catalog.xss) {
    it(`[${c.id}] string ${c.category}`, () => {
      const out = sanitizeString(c.payload, { maxLength: 5000 });
      assertNoActiveHtml(out);
    });
  }
});

describe('security.xss — sanitizeUserContent neutralizes payloads', () => {
  for (const c of catalog.xss) {
    it(`[${c.id}] userContent ${c.category}`, () => {
      const out = sanitizeUserContent(c.payload, 5000);
      assertNoActiveHtml(out);
    });
  }
});

describe('security.xss — escapeHtml encodes dangerous chars', () => {
  for (const c of catalog.xss) {
    it(`[${c.id}] escapeHtml ${c.category}`, () => {
      const out = escapeHtml(c.payload);
      assertNoActiveHtml(out);
      if (/[<>&"']/.test(c.payload)) {
        expect(out).not.toBe(c.payload);
      }
    });
  }
});

describe('security.xss — stripHtml removes tags', () => {
  for (const c of catalog.xss) {
    it(`[${c.id}] stripHtml ${c.category}`, () => {
      const out = stripHtml(c.payload);
      expect(out).not.toMatch(/<[^>]+>/);
    });
  }
});

describe('security.xss — mega xss grid', () => {
  const mega = generateXssPayloads(800);
  for (const c of mega) {
    it(`[${c.id}] mega xss`, () => {
      assertNoActiveHtml(sanitizeString(c.payload, { maxLength: 8000 }));
    });
  }
});

describe('security.null-byte — removeNullBytes', () => {
  for (const c of catalog.nulls) {
    it(`[${c.id}] null byte`, () => {
      expect(removeNullBytes(c.payload)).not.toContain('\0');
      expect(sanitizeString(c.payload, { maxLength: 200 })).not.toContain('\0');
    });
  }
  const extra = generateNullBytePayloads(200);
  for (const c of extra) {
    it(`[${c.id}] extra null`, () => {
      expect(removeNullBytes(c.payload)).not.toContain('\0');
    });
  }
});

describe('security.path-traversal — folder names bounded and tag-stripped', () => {
  for (const c of catalog.paths) {
    it(`[${c.id}] path ${c.category}`, () => {
      const out = sanitizeString(c.payload, { maxLength: 255, allowNewlines: false });
      expect(out.length).toBeLessThanOrEqual(255);
      expect(out).not.toMatch(/<script/i);
    });
  }
  const extra = generatePathTraversalStrings(200);
  for (const c of extra) {
    it(`[${c.id}] extra path`, () => {
      const out = sanitizeString(c.payload, { maxLength: 255, allowNewlines: false });
      expect(out.length).toBeLessThanOrEqual(255);
    });
  }
});

describe('security.command-injection — usernames stripped', () => {
  for (const c of catalog.commands) {
    it(`[${c.id}] username cmd`, () => {
      const out = sanitizeUsername(c.payload);
      expect(out).not.toMatch(/[;|`$&]/);
    });
  }
  const extra = generateCommandInjectionStrings(200);
  for (const c of extra) {
    it(`[${c.id}] extra cmd`, () => {
      expect(sanitizeUsername(c.payload).length).toBeLessThanOrEqual(50);
    });
  }
});

describe('security.sqli — strings stored without raw tags', () => {
  for (const c of catalog.sqli) {
    it(`[${c.id}] sqli string`, () => {
      const out = sanitizeString(c.payload, { maxLength: 500 });
      expect(out).not.toMatch(/<script/i);
    });
  }
  const extra = generateSqlInjectionStrings(400);
  for (const c of extra) {
    it(`[${c.id}] extra sqli`, () => {
      const out = sanitizeObject({ q: c.payload, nested: { x: c.payload } });
      expect(JSON.stringify(out)).not.toContain('<script');
    });
  }
});

describe('security.xss — nested object sanitization grid', () => {
  for (let i = 0; i < 300; i++) {
    it(`nested object ${i}`, () => {
      const out = sanitizeObject({
        title: `<script>${i}</script>`,
        items: [`<b>${i}</b>`, { note: `<img onerror=x ${i}>` }],
      });
      expect(JSON.stringify(out)).not.toMatch(/<script/i);
      expect(JSON.stringify(out)).not.toMatch(/onerror/i);
    });
  }
});
