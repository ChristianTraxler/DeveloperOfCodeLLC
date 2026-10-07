// Visual QA: phone (390px) and desktop (1440px) captures of every section, plus a live save test.
// Usage: node scripts/shoot.mjs /abs/path/index.html /abs/out/dir tag
// Uses the project's playwright if installed, otherwise a global install.
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  ({ chromium } = await import('/home/claude/.npm-global/lib/node_modules/playwright/index.mjs'));
}
import { mkdirSync } from 'node:fs';

const [, , htmlPath, outDir, tag, mode] = process.argv;
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const sizes = [['m', { width: 390, height: 844 }, 2, true], ['d', { width: 1440, height: 900 }, 1, false]];
for (const [name, viewport, dpr, mobile] of sizes) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
  if (mode) await ctx.addInitScript((m) => { try { localStorage.setItem('outlay:mode:dial', m); } catch (e) { /* storage blocked */ } }, mode);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  await page.goto(`file://${htmlPath}`, { waitUntil: 'load' });
  await page.waitForSelector('#overview', { timeout: 20000 });
  await page.waitForTimeout(700);
  const shot = (label) => page.screenshot({ path: `${outDir}/${tag}-${name}-${label}.png` });
  const goTo = async (selector, extra = 0) => {
    await page.evaluate(([s, x]) => { const el = document.querySelector(s); window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + x); }, [selector, extra]);
    await page.waitForTimeout(300);
  };
  await shot('1-hero');
  await goTo('#ledger'); await shot('2-ledger');
  await goTo('#spending'); await shot('3-spending');
  await goTo('#billable'); await shot('4-billable');
  await goTo('#recurring'); await shot('5-recurring');
  await goTo('#recurring', mobile ? 900 : 760); await shot('6-renewals');
  await goTo('#taxes'); await shot('7-taxes');
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(300); await shot('8-footer');
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300);
  await page.locator('#overview .btn-primary').first().click();
  await page.waitForTimeout(600); await shot('9-sheet');
  await page.fill('#x-amount', '42.50');
  await page.fill('#x-vendor', 'QA Test Vendor');
  await page.locator('.sheet-foot .btn-primary').click();
  await page.waitForTimeout(700);
  const saved = await page.locator('.d-row-vendor').filter({ hasText: 'QA Test Vendor' }).count();
  const fabVisible = await page.evaluate(() => { window.scrollTo(0, 3000); return new Promise((r) => setTimeout(() => r(document.querySelector('.fab')?.classList.contains('is-visible')), 250)); });
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.evaluate(() => window.scrollTo(0, 0));
  const before = await page.evaluate(() => document.documentElement.dataset.mode);
  await page.locator(`.mode-toggle button[aria-label="${before === 'dark' ? 'Light mode' : 'Dark mode'}"]:visible`).first().click();
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => document.documentElement.dataset.mode);
  console.log(JSON.stringify({ tag, name, height, saved, fabVisible, mode: `${before} to ${after}`, errors }));
  await ctx.close();
}
await browser.close();
