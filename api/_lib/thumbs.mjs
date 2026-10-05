// api/_lib/thumbs.mjs: screenshot a live demo as a 1280x800 WebP.
// Headless Chromium is loaded on demand so the other demo actions never pay for it.

export const THUMB_SIZE = { width: 1280, height: 800 };

export async function captureWebp(url) {
  const [{ default: chromium }, { default: puppeteer }] = await Promise.all([
    import('@sparticuz/chromium'),
    import('puppeteer-core'),
  ]);
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: 'shell',
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ ...THUMB_SIZE, deviceScaleFactor: 1 });
    const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });
    if (!response || response.status() >= 400) throw new Error(`The demo answered ${response?.status() ?? 'nothing'}.`);
    // Let entrance animations settle before the shot.
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return Buffer.from(await page.screenshot({ type: 'webp', quality: 80 }));
  } finally {
    await browser.close();
  }
}
