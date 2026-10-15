// api/_lib/seo-render.mjs: read a JavaScript-built page the way Google does, in headless Chromium.
// Same Chromium setup as api/_lib/thumbs.mjs. Loaded only when a site turns out to be a
// JavaScript app, so plain HTML sites never pay the start-up cost.
// Local dev: set CHROME_PATH to a local Chrome or Chromium to skip the bundled one.

import { FETCH } from './seo-config.mjs';
import { isPublicUrl } from './seo-checks.mjs';
import { startEgressProxy } from './seo-egress.mjs';

export async function renderHtml(url, timeoutMs = FETCH.renderTimeoutMs) {
  const [{ default: chromium }, { default: puppeteer }] = await Promise.all([import('@sparticuz/chromium'), import('puppeteer-core')]);
  chromium.setGraphicsMode = false;
  // All browser traffic goes through the local egress proxy, which only connects to public
  // addresses it has checked itself (see seo-egress.mjs). QUIC and direct WebRTC would skip it.
  const proxy = await startEgressProxy();
  const egress = [`--proxy-server=http://127.0.0.1:${proxy.port}`, '--proxy-bypass-list=<-loopback>', '--disable-quic', '--webrtc-ip-handling-policy=disable_non_proxied_udp', '--force-webrtc-ip-handling-policy'];
  let browser;
  try {
    browser = await puppeteer.launch({
      args: [...(process.env.CHROME_PATH ? ['--no-sandbox', '--disable-gpu'] : chromium.args), ...egress],
      executablePath: process.env.CHROME_PATH || (await chromium.executablePath()),
      headless: 'shell',
    });
    const page = await browser.newPage();
    await page.setBypassServiceWorker(true);
    await page.setUserAgent(FETCH.userAgent);
    await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 1, isMobile: true });
    // Images, fonts and media do not change the text, so skip them to save time. Every other
    // request, including each redirect hop and anything the page's scripts load, must go to a
    // public http(s) host, the same rule safeFetch applies, so a site cannot point the browser
    // at private addresses.
    await page.setRequestInterception(true);
    page.on('request', async (req) => {
      const url = req.url();
      if (url.startsWith('data:') || url.startsWith('blob:')) return req.continue();
      if (['image', 'media', 'font'].includes(req.resourceType()) || !(await isPublicUrl(url))) return req.abort();
      return req.continue();
    });
    const until = Date.now() + timeoutMs;
    await page.goto(url, { waitUntil: 'load', timeout: timeoutMs });
    // Wait for the app to draw real content, then a beat for late headings and links.
    await page
      .waitForFunction((min) => (document.body?.innerText || '').trim().length > min, { timeout: Math.max(500, Math.min(5000, until - Date.now())) }, FETCH.spaTextThreshold)
      .catch(() => {});
    await new Promise((r) => setTimeout(r, Math.max(0, Math.min(700, until - Date.now()))));
    return await page.content();
  } finally {
    await browser?.close().catch(() => {});
    await proxy.close();
  }
}
