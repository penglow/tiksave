import puppeteer from 'puppeteer-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = process.env.PORT || '8099';
const OUT = process.env.OUT || 'C:/Users/abdul/Music/tiksave/tiksave/.run-logs';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const page = await browser.newPage();
await page.setViewport({ width: 420, height: 900, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', (e) => errs.push(`[pageerror] ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errs.push(`[console.error] ${m.text()}`);
});

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise((r) => setTimeout(r, 3000));

// Sign up
const email = `t${Date.now()}@x.com`;
const password = 'password123';
await page.evaluate((e, p) => {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  const ins = document.querySelectorAll('input');
  if (ins[0]) { set.call(ins[0], e); ins[0].dispatchEvent(new Event('input', { bubbles: true })); }
  if (ins[1]) { set.call(ins[1], p); ins[1].dispatchEvent(new Event('input', { bubbles: true })); }
}, email, password);
await new Promise((r) => setTimeout(r, 300));
await page.evaluate(() => {
  const link = Array.from(document.querySelectorAll('*')).find((el) => el.textContent?.trim() === 'Create one');
  link?.click();
});
await new Promise((r) => setTimeout(r, 300));
await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('*')).find((el) => {
    const t = el.textContent?.trim();
    return t === 'Sign Up' || t === 'Create Account' || t === 'Create account';
  });
  btn?.click();
});
await new Promise((r) => setTimeout(r, 3500));

// Navigate to Import via the empty-state CTA
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
await new Promise((r) => setTimeout(r, 2000));

await page.screenshot({ path: `${OUT}/import-empty.png` });

// Check for the ghost CTA label
const ghostVisible = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('*')).some((el) =>
    el.textContent?.trim() === 'Paste a link to start',
  );
});
console.log('ghost label present:', ghostVisible);

// Type URLs and screenshot
await page.evaluate(() => {
  const inp = Array.from(document.querySelectorAll('textarea, input')).find((i) =>
    i.placeholder?.includes('tiktok'),
  );
  if (inp) {
    const proto = inp.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const set = Object.getOwnPropertyDescriptor(proto, 'value').set;
    set.call(inp, 'https://www.tiktok.com/@a/video/1\nhttps://www.tiktok.com/@b/video/2');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  }
});
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: `${OUT}/import-with-urls.png` });

const importLabel = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('*')).some((el) =>
    el.textContent?.trim() === 'Import 2 →',
  );
});
console.log('import label present:', importLabel);

if (errs.length > 0) {
  console.log('ERRORS:');
  console.log(errs.join('\n'));
}

await browser.close();
