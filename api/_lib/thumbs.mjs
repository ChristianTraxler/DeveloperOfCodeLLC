// api/_lib/thumbs.mjs: screenshot a live demo as a 1280x800 WebP.
// Headless Chromium is loaded on demand so the other demo actions never pay for it.

export const THUMB_SIZE = { width: 1280, height: 800 };

export async function captureWebp(url) {
  const [{ default: chromium }, { default: puppeteer }] = await Promise.all([
    import('@sparticuz/chromium'),
    import('puppeteer-core'),
  ]);
  // Skips WebGL setup: faster cold start, and a demo screenshot does not need it.
  chromium.setGraphicsMode = false;
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: 'shell',
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ ...THUMB_SIZE, deviceScaleFactor: 1 });
    const response = await page.goto(url, { waitUntil: 'load', timeout: 20000 });
    if (!response || response.status() >= 400) throw new Error(`The demo answered ${response?.status() ?? 'nothing'}.`);
    // 'load' instead of waiting for the network to go quiet (slow to finish on some demos),
    // then a short pause so entrance animations and lazy images can settle.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return Buffer.from(await page.screenshot({ type: 'webp', quality: 80 }));
  } finally {
    await browser.close();
  }
}
