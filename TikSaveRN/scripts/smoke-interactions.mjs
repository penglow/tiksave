/**
 * smoke-interactions.mjs
 * Automated interaction checks for the redesigned Import screen.
 * Verifies click-only behaviours that do NOT require TikTok backend integration.
 *
 * Run:  cd TikSaveRN && PORT=8099 node scripts/smoke-interactions.mjs
 */

import puppeteer from 'puppeteer-core';
import { OUT, PORT, resolveChromeExecutable } from './smoke-config.mjs';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Set a textarea / input value via the React-internal setter so onChange fires. */
async function reactSet(page, selector, value) {
  await page.evaluate((sel, val) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, val);
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, selector, value);
}

/** Find an element whose trimmed textContent equals `text`, return its bounding box. */
async function findByText(page, text) {
  return page.evaluate((t) => {
    const el = Array.from(document.querySelectorAll('*')).find(
      (e) => e.childElementCount === 0 && e.textContent?.trim() === t,
    );
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
  }, text);
}

/** Click the element whose trimmed textContent equals `text`. */
async function clickByText(page, text) {
  const box = await findByText(page, text);
  if (!box) throw new Error(`Element with text "${text}" not found`);
  await page.mouse.click(box.cx, box.cy);
  return box;
}

/** Check whether any visible element contains `substring` in its textContent. */
async function textExists(page, substring) {
  return page.evaluate(
    (sub) => Array.from(document.querySelectorAll('*')).some((e) => e.textContent?.includes(sub)),
    substring,
  );
}

/** Get the CSS transform of the input wrapper (Animated.View around the textarea). */
async function getInputWrapperTransform(page) {
  return page.evaluate(() => {
    const ta = document.querySelector('textarea');
    if (!ta) return null;
    // Walk up to find an ancestor that has a non-identity translateX
    let el = ta.parentElement;
    for (let i = 0; i < 6 && el; i++) {
      const t = window.getComputedStyle(el).transform;
      if (t && t !== 'none' && t !== 'matrix(1, 0, 0, 1, 0, 0)') return t;
      el = el.parentElement;
    }
    return window.getComputedStyle(ta.parentElement).transform;
  });
}

// ─── Boot browser ────────────────────────────────────────────────────────────

const browser = await puppeteer.launch({
  executablePath: resolveChromeExecutable(),
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const page = await browser.newPage();
await page.setViewport({ width: 420, height: 900, deviceScaleFactor: 1 });

const consoleErrors = [];
page.on('pageerror',  (e) => consoleErrors.push(`[pageerror] ${e.message}`));
page.on('console',   (m) => {
  if (m.type() === 'error') consoleErrors.push(`[console.error] ${m.text()}`);
});

// ─── Auth ────────────────────────────────────────────────────────────────────

console.log('→ Loading app…');
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle2', timeout: 60000 });
await sleep(3000);

const email    = `t${Date.now()}@x.com`;
const password = 'password123';
console.log(`→ Signing up as ${email}`);

await page.evaluate((e, p) => {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  const ins = document.querySelectorAll('input');
  if (ins[0]) { set.call(ins[0], e); ins[0].dispatchEvent(new Event('input', { bubbles: true })); }
  if (ins[1]) { set.call(ins[1], p); ins[1].dispatchEvent(new Event('input', { bubbles: true })); }
}, email, password);
await sleep(300);

// Click "Create one" to switch to sign-up form (if present)
await page.evaluate(() => {
  const link = Array.from(document.querySelectorAll('*')).find(
    (el) => el.textContent?.trim() === 'Create one',
  );
  link?.click();
});
await sleep(300);

// Click sign-up submit button
await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('*')).find((el) => {
    const t = el.textContent?.trim();
    return t === 'Sign Up' || t === 'Create Account' || t === 'Create account';
  });
  btn?.click();
});
await sleep(3500);

// ─── Navigate to Import ──────────────────────────────────────────────────────

console.log('→ Navigating to Import…');

// Try the bottom-tab "Import" / "Add" nav item first
const tabClicked = await page.evaluate(() => {
  const tab = Array.from(document.querySelectorAll('*')).find((el) => {
    const t = el.textContent?.trim();
    return t === 'Import' || t === 'Add';
  });
  if (tab) { tab.click(); return true; }
  return false;
});

if (!tabClicked) {
  // Fall back to the Library empty-state CTA
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('*')).find((el) => {
      const t = el.textContent?.trim();
      return t === '+ Import videos' || t === 'Import videos';
    });
    if (btn) {
      let cur = btn;
      for (let i = 0; i < 4 && cur; i++) { cur.click?.(); cur = cur.parentElement; }
    }
  });
}
await sleep(2000);

// ─── Selector for the textarea ───────────────────────────────────────────────

const TA_SEL = 'textarea';   // aria-label="TikTok URLs" renders as a <textarea> on web

// ─── Results accumulator ─────────────────────────────────────────────────────

const results = [];

function record(name, pass, evidence) {
  const status = pass ? 'PASS' : 'FAIL';
  results.push({ name, status, evidence });
  console.log(`  [${status}] ${name}: ${evidence}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECK 1 — Empty press shakes input
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n── Check 1: Empty press shakes input ──');

// 1a. Ghost button must be visible
const ghostVisible = await textExists(page, 'Paste a link to start');
record('Check 1a — ghost button visible', ghostVisible, `ghostVisible=${ghostVisible}`);

// 1b. Click ghost button, take screenshot at ~120ms (mid-shake)
const transformBefore = await getInputWrapperTransform(page);
console.log(`     transform before click: ${transformBefore}`);

try {
  await clickByText(page, 'Paste a link to start');
} catch {
  // If text-click fails (the button may be the whole button element), try accessibility label
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('*')).find(
      (e) => e.getAttribute?.('aria-label') === 'Paste a link to start',
    );
    el?.click();
  });
}

// Screenshot at 120ms — mid-shake, expect translateX != 0
await sleep(120);
const transformDuring = await getInputWrapperTransform(page);
console.log(`     transform during shake: ${transformDuring}`);
await page.screenshot({ path: `${OUT}/import-shake.png` });
await sleep(400); // let shake settle

// Parse translateX from matrix(a,b,c,d,tx,ty)
function parseTX(m) {
  if (!m || m === 'none') return 0;
  const parts = m.match(/matrix\(([^)]+)\)/);
  if (!parts) return 0;
  const nums = parts[1].split(',').map((n) => parseFloat(n.trim()));
  return nums[4] ?? 0; // tx is the 5th element
}

const txBefore = parseTX(transformBefore);
const txDuring = parseTX(transformDuring);
const shookDetected = Math.abs(txDuring - txBefore) > 0.5;
record(
  'Check 1b — shake detected (transform offset)',
  shookDetected,
  `txBefore=${txBefore.toFixed(2)}, txDuring=${txDuring.toFixed(2)}, diff=${Math.abs(txDuring - txBefore).toFixed(2)}`,
);

// ═══════════════════════════════════════════════════════════════════════════════
// CHECK 2 — Invalid URL shows error chip + shake
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n── Check 2: Invalid URL shows error chip + shake ──');

// 2a. Type an invalid URL
await reactSet(page, TA_SEL, 'not a real url');
await sleep(500);

// Ghost button should still be present (no valid TikTok URLs)
const ghostStillVisible = await textExists(page, 'Paste a link to start');
record('Check 2a — ghost still shown for non-URL text', ghostStillVisible, `ghostStillVisible=${ghostStillVisible}`);

// 2b. Click ghost button
try {
  await clickByText(page, 'Paste a link to start');
} catch {
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('*')).find(
      (e) => e.getAttribute?.('aria-label') === 'Paste a link to start',
    );
    el?.click();
  });
}
await sleep(120);
await page.screenshot({ path: `${OUT}/import-invalid.png` });

// 2c. Verify error chip OR shake
//   The logic in AddVideoScreen: handleEmptyPress → triggerInputShake (no error chip for empty press).
//   But with a parsed non-TikTok URL and clicking the ghost button, handleEmptyPress still fires
//   (because validUrls.length === 0 → ghost variant → onPressGhost → triggerInputShake).
//   The error chip text "doesn't look like a TikTok URL" is only emitted from handleSingleImport.
//   So for an invalid URL in the ghost state, we expect a shake, not an error chip.
const transformDuringInvalid = await getInputWrapperTransform(page);
const txDuringInvalid = parseTX(transformDuringInvalid);
const shookInvalid = Math.abs(txDuringInvalid) > 0.5;

// Also check if an error chip appeared (it may appear if code path differs)
const errorChipVisible = await page.evaluate(() =>
  Array.from(document.querySelectorAll('*')).some(
    (e) => e.textContent?.includes("TikTok") && e.textContent?.includes("URL"),
  ),
);
record(
  'Check 2b — shake OR error chip for invalid URL',
  shookInvalid || errorChipVisible,
  `shakeTX=${txDuringInvalid.toFixed(2)}, errorChip=${errorChipVisible}`,
);
await sleep(400);

// ═══════════════════════════════════════════════════════════════════════════════
// CHECK 3 — Non-TikTok URL shows count breakdown + ghost button
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n── Check 3: Non-TikTok URL shows count breakdown ──');

// Clear and type YouTube URL
await reactSet(page, TA_SEL, '');
await sleep(200);
await reactSet(page, TA_SEL, 'https://youtube.com/watch?v=x');
await sleep(400);

await page.screenshot({ path: `${OUT}/import-non-tiktok.png` });

// 3a. Count text "1 URL detected · 1 not TikTok"
const countText1 = await textExists(page, '1 URL detected · 1 not TikTok');
// Also try singular variant
const countText1alt = await textExists(page, '1 URLs detected · 1 not TikTok');
record(
  'Check 3a — count breakdown "1 URL detected · 1 not TikTok"',
  countText1 || countText1alt,
  `found="${countText1 ? '1 URL detected · 1 not TikTok' : countText1alt ? '1 URLs detected · 1 not TikTok' : 'NOT FOUND'}"`,
);

// 3b. Ghost button still present (no valid TikTok URLs)
const ghostAfterYT = await textExists(page, 'Paste a link to start');
record('Check 3b — ghost button still present for non-TikTok URL', ghostAfterYT, `ghostVisible=${ghostAfterYT}`);

// ═══════════════════════════════════════════════════════════════════════════════
// CHECK 4 — Valid TikTok URL flips button to solid "Import 1 →"
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n── Check 4: Valid TikTok URL flips button to solid ──');

await reactSet(page, TA_SEL, '');
await sleep(200);
await reactSet(page, TA_SEL, 'https://www.tiktok.com/@user/video/123');
await sleep(400);

await page.screenshot({ path: `${OUT}/import-one-valid.png` });

// 4a. Count text — no "not TikTok" suffix
const countValid = await textExists(page, '1 URL detected');
const notTikTokSuffix = await textExists(page, 'not TikTok');
record(
  'Check 4a — count reads "1 URL detected" (no "not TikTok" suffix)',
  countValid && !notTikTokSuffix,
  `"1 URL detected"=${countValid}, "not TikTok" present=${notTikTokSuffix}`,
);

// 4b. Button flipped to solid "Import 1 →"
const importLabel = await textExists(page, 'Import 1 →');
record('Check 4b — solid button "Import 1 →" visible', importLabel, `importLabel=${importLabel}`);

// 4c. Ghost button should be gone
const ghostGone = !(await textExists(page, 'Paste a link to start'));
record('Check 4c — ghost button gone', ghostGone, `ghostGone=${ghostGone}`);

// ═══════════════════════════════════════════════════════════════════════════════
// CHECK 5 — Removing preview chip clears the URL
// ═══════════════════════════════════════════════════════════════════════════════
console.log('\n── Check 5: Removing preview chip removes URL ──');

// Find and click the × button on the preview chip (accessibilityLabel starts with "Remove ")
const chipRemoveClicked = await page.evaluate(() => {
  const removeBtn = Array.from(document.querySelectorAll('*')).find((el) => {
    const label = el.getAttribute?.('aria-label') ?? '';
    return label.startsWith('Remove ');
  });
  if (removeBtn) { removeBtn.click(); return true; }
  return false;
});
console.log(`     chipRemoveClicked=${chipRemoveClicked}`);
await sleep(400);

await page.screenshot({ path: `${OUT}/import-after-remove.png` });

// 5a. Input should be empty
const inputEmpty = await page.evaluate(() => {
  const ta = document.querySelector('textarea');
  return !ta || ta.value.trim() === '';
});
record('Check 5a — input empty after chip removal', inputEmpty, `inputEmpty=${inputEmpty}`);

// 5b. Ghost button back
const ghostBack = await textExists(page, 'Paste a link to start');
record('Check 5b — ghost button back after chip removal', ghostBack, `ghostBack=${ghostBack}`);

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════');
console.log('RESULTS');
console.log('══════════════════════════════════════════════════════');
let allPass = true;
for (const r of results) {
  const icon = r.status === 'PASS' ? '✓' : '✗';
  console.log(`${icon} [${r.status}] ${r.name}`);
  console.log(`         ${r.evidence}`);
  if (r.status !== 'PASS') allPass = false;
}
console.log('──────────────────────────────────────────────────────');
console.log(allPass ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED');

console.log('\nDEFERRED — requires live verification:');
console.log('  • Single import flow (real TikTok backend)');
console.log('  • Batch import flow (real TikTok backend)');
console.log('  • Tab-switch persistence (needs in-flight import)');
console.log('  • Cancel flow (needs in-flight import)');
console.log('  • Clipboard chip (headless Chrome blocks clipboard permission)');

if (consoleErrors.length > 0) {
  console.log('\nBROWSER ERRORS:');
  consoleErrors.forEach((e) => console.log(' ', e));
}

await browser.close();
process.exit(allPass ? 0 : 1);
