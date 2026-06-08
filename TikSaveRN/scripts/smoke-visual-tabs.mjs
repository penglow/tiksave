/**
 * Capture screenshots of each main tab for visual QA (light + dark).
 * Run: cd TikSaveRN && bun run web (PORT=8099) then node scripts/smoke-visual-tabs.mjs
 */

import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'node:fs';
import { OUT, PORT, resolveChromeExecutable } from './smoke-config.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const THEMES = process.env.THEMES
  ? process.env.THEMES.split(',')
  : ['light', 'dark'];

async function clickTab(page, label) {
  await page.evaluate((tabLabel) => {
    const el = Array.from(document.querySelectorAll('*')).find(
      (e) => e.childElementCount === 0 && e.textContent?.trim() === tabLabel,
    );
    if (el) {
      let cur = el;
      for (let i = 0; i < 6 && cur; i++) {
        cur.click?.();
        cur = cur.parentElement;
      }
    }
  }, label);
}

async function setTheme(page, theme) {
  await page.evaluate((t) => {
    const raw = localStorage.getItem('userSettings');
    const settings = raw ? JSON.parse(raw) : {};
    settings.theme = t;
    localStorage.setItem('userSettings', JSON.stringify(settings));
  }, theme);
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(2500);
}

async function signUp(page) {
  const email = `visual${Date.now()}@test.com`;
  const password = 'password123';
  await page.evaluate((e, p) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    const ins = document.querySelectorAll('input');
    if (ins[0]) {
      set.call(ins[0], e);
      ins[0].dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (ins[1]) {
      set.call(ins[1], p);
      ins[1].dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, email, password);
  await sleep(400);
  await page.evaluate(() => {
    const link = Array.from(document.querySelectorAll('*')).find(
      (el) => el.textContent?.trim() === 'Create one',
    );
    link?.click();
  });
  await sleep(400);
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('*')).find((el) => {
      const t = el.textContent?.trim();
      return t === 'Sign Up' || t === 'Create Account' || t === 'Create account';
    });
    btn?.click();
  });
  await sleep(4000);
}

async function captureTabs(page, theme, errs) {
  const tabs = ['Library', 'Import', 'Search', 'Map', 'Settings'];
  for (const tab of tabs) {
    await clickTab(page, tab);
    await sleep(tab === 'Map' ? 4500 : 2000);
    const path = `${OUT}/tab-${tab.toLowerCase()}-${theme}.png`;
    await page.screenshot({ path, fullPage: false });
    console.log('screenshot:', path);
  }
}

const browser = await puppeteer.launch({
  executablePath: resolveChromeExecutable(),
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

const errs = [];
page.on('pageerror', (e) => errs.push(`[pageerror] ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errs.push(`[console.error] ${m.text()}`);
});

try {
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle2', timeout: 90000 });
  await sleep(2500);
  await signUp(page);

  for (const theme of THEMES) {
    console.log(`\n--- Theme: ${theme} ---`);
    await setTheme(page, theme);
    await captureTabs(page, theme, errs);
  }

  writeFileSync(`${OUT}/visual-errors.json`, JSON.stringify(errs, null, 2));
  if (errs.length) {
    console.log('Runtime errors:', errs.length);
    console.log(errs.slice(0, 20).join('\n'));
  }
} catch (e) {
  console.error('Visual smoke failed:', e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
