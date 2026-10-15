// api/_lib/seo-render.mjs: read a JavaScript-built page the way Google does, in headless Chromium.
// Same Chromium setup as api/_lib/thumbs.mjs. Loaded only when a site turns out to be a
// JavaScript app, so plain HTML sites never pay the start-up cost.
// Local dev: set CHROME_PATH to a local Chrome or Chromium to skip the bundled one.

import { FETCH } from './seo-config.mjs';

export async function renderHtml(url, timeoutMs = FETCH.renderTimeoutMs) {
  const [{ default: chromium }, { default: puppeteer }] = await Promise.all([import('@sparticuz/chromium'), import('puppeteer-core')]);
  chromium.setGraphicsMode = false;
  const browser = await puppeteer.launch({
    args: process.env.CHROME_PATH ? ['--no-sandbox', '--disable-gpu'] : chromium.args,
    executablePath: process.env.CHROME_PATH || (await chromium.executablePath()),
    headless: 'shell',
  });
  try {
    const page = await browser.newPage();
    await page.setUserAgent(FETCH.userAgent);
    await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 1, isMobile: true });
    // Images, fonts and media do not change the text, so skip them to save time.
    await page.setRequestInterception(true);
    page.on('request', (req) => (['image', 'media', 'font'].includes(req.resourceType()) ? req.abort() : req.continue()));
    const until = Date.now() + timeoutMs;
    await page.goto(url, { waitUntil: 'load', timeout: timeoutMs });
    // Wait for the app to draw real content, then a beat for late headings and links.
    await page
      .waitForFunction((min) => (document.body?.innerText || '').trim().length > min, { timeout: Math.max(500, Math.min(5000, until - Date.now())) }, FETCH.spaTextThreshold)
      .catch(() => {});
    await new Promise((r) => setTimeout(r, Math.max(0, Math.min(700, until - Date.now()))));
    return await page.content();
  } finally {
    await browser.close();
  }
}
