import { existsSync, mkdirSync } from 'node:fs';
import { platform } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRunLogs = resolve(dirname(fileURLToPath(import.meta.url)), '../../.run-logs');

export const PORT = process.env.PORT || '8099';

export const OUT = process.env.OUT || repoRunLogs;
mkdirSync(OUT, { recursive: true });

/** @returns {string} */
export function resolveChromeExecutable() {
  const fromEnv = process.env.CHROME || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (fromEnv) return fromEnv;

  const localAppData = process.env.LOCALAPPDATA;
  const candidates = {
    win32: [
      localAppData && `${localAppData}/Google/Chrome/Application/chrome.exe`,
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    ],
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ],
    linux: [
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
    ],
  }[platform()] ?? [];

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate;
  }

  throw new Error(
    'Chrome/Chromium not found. Set CHROME or PUPPETEER_EXECUTABLE_PATH to your browser executable.',
  );
}
