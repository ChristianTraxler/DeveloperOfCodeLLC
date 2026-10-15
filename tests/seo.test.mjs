// Run with: npm run test:seo
// No network: every site, robots.txt, sitemap and PageSpeed answer below is made up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runAudit, parseRobots, robotsAllows, normalizeUrl, setHostGuard, AuditInputError } from '../api/_lib/seo-checks.mjs';
import { readPage, mentions, cityName } from '../api/_lib/seo-html.mjs';
import { CATEGORIES, CHECKS, STATUS_POINTS } from '../api/_lib/seo-config.mjs';

setHostGuard(async () => {});

const GOOD_HOME = `<!doctype html><html lang="en"><head>
<title>Pressure Washing in Hickory, NC | Blue Ridge Wash</title>
<meta name="description" content="House, driveway and deck pressure washing in Hickory, NC. Licensed and insured. Get a free quote today from a local crew that shows up on time.">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"HomeAndConstructionBusiness","name":"Blue Ridge Wash","telephone":"+1-828-555-0100","address":{"@type":"PostalAddress","streetAddress":"1 Main St","addressLocality":"Hickory"},"url":"https://blueridge.test/","openingHours":"Mo-Fr 08:00-17:00","image":"https://blueridge.test/logo.png","areaServed":"Catawba County"}</script>
</head><body>
<h1>Pressure washing in Hickory</h1>
<p>We wash houses, driveways and decks across Hickory and Catawba County. ${'Honest work. '.repeat(30)}</p>
<img src="/a.jpg" alt="Clean driveway in Hickory"><img src="/b.jpg" alt="Washed deck">
<a href="/services">Services</a><a href="/about">About</a><a href="/contact">Contact</a><a href="/reviews">Reviews</a><a href="/areas">Areas</a>
<a href="https://facebook.test/blueridge">Facebook</a><a href="tel:8285550100">Call</a>
</body></html>`;

const BAD_HOME = `<html><head><title>Home</title></head><body><div>Welcome</div><img src="a.jpg"><img src="b.jpg"><a href="/missing">Old page</a></body></html>`;

const PSI = (score) => ({
  lighthouseResult: {
    lighthouseVersion: '12.8.2',
    categories: { performance: { score }, seo: { score: 0.92 } },
    audits: { 'largest-contentful-paint': { displayValue: '3.1 s', score: 0.6 }, viewport: { score: 1 }, 'final-screenshot': { details: { data: 'data:image/jpeg;base64,AAAA' } } },
  },
});

// A tiny fake internet. routes: { 'https://host/path': { status, body, type, location } | fn }
function fakeFetch(routes, { psi = PSI(0.72), psiStatus = 200 } = {}) {
  const calls = [];
  const fn = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET' });
    if (String(url).startsWith('https://www.googleapis.com/pagespeedonline')) {
      return new Response(JSON.stringify(psiStatus === 200 ? psi : { error: { message: 'Quota' } }), { status: psiStatus, headers: { 'content-type': 'application/json' } });
    }
    const hit = routes[String(url)];
    const r = typeof hit === 'function' ? hit() : hit;
    if (!r) return new Response('Not found', { status: 404, headers: { 'content-type': 'text/html' } });
    const headers = { 'content-type': r.type || 'text/html' };
    if (r.location) headers.location = r.location;
    return new Response(init.method === 'HEAD' ? null : r.body ?? '', { status: r.status ?? 200, headers });
  };
  fn.calls = calls;
  return fn;
}

const input = { url: 'blueridge.test', business: 'Blue Ridge Wash', city: 'Hickory, NC', service: 'Pressure washing' };
const byKey = (out) => Object.fromEntries(out.checks.map((c) => [c.key, c]));

test('config: weights total 100, every check has a category, phase and service', () => {
  assert.equal(Object.values(CATEGORIES).reduce((s, c) => s + c.weight, 0), 100);
  assert.equal(Object.keys(CHECKS).length, 18);
  for (const [k, c] of Object.entries(CHECKS)) {
    assert.ok(CATEGORIES[c.category], `${k} category`);
    assert.ok([1, 3].includes(c.phase), `${k} phase`);
    assert.ok(['high', 'medium', 'low'].includes(c.impact) && ['small', 'medium', 'large'].includes(c.effort), `${k} ratings`);
  }
  assert.deepEqual(STATUS_POINTS, { pass: 1, warn: 0.5, fail: 0, skipped: null });
});

test('normalizeUrl adds https and rejects junk', () => {
  assert.equal(normalizeUrl('example.com').href, 'https://example.com/');
  assert.equal(normalizeUrl('http://example.com/x#y').href, 'http://example.com/x');
  assert.throws(() => normalizeUrl(''), AuditInputError);
  assert.throws(() => normalizeUrl('localhost'), AuditInputError);
});

test('robots.txt rules: longest match wins, allow breaks ties, named agents beat *', () => {
  const r = parseRobots('User-agent: *\nDisallow: /private\nAllow: /private/ok\n\nUser-agent: BadBot\nDisallow: /\n\nSitemap: https://x.test/sitemap.xml');
  assert.equal(robotsAllows(r, 'DOCSEOReview', '/'), true);
  assert.equal(robotsAllows(r, 'DOCSEOReview', '/private/a'), false);
  assert.equal(robotsAllows(r, 'DOCSEOReview', '/private/ok/1'), true);
  assert.equal(robotsAllows(r, 'BadBot', '/'), false);
  assert.deepEqual(r.sitemaps, ['https://x.test/sitemap.xml']);
  assert.equal(robotsAllows(parseRobots('User-agent: *\nDisallow:'), 'x', '/'), true);
  assert.equal(robotsAllows(parseRobots('User-agent: *\nDisallow: /*.pdf$'), 'x', '/a.pdf'), false);
});

test('readPage ignores svg titles and script text, and reads JSON-LD', () => {
  const p = readPage('<html><head><title>Real</title></head><body><svg><title>Icon</title></svg><h1>Hi <b>there</b></h1><script>var t="<h1>no</h1>"</script><script type="application/ld+json">{"@type":"Dentist"}</script></body></html>');
  assert.deepEqual(p.titles, ['Real']);
  assert.deepEqual(p.h1s, ['Hi there']);
  assert.equal(p.jsonLd.length, 1);
});

test('keyword matching handles word forms and city formats', () => {
  assert.ok(mentions('Expert Pressure Wash crew', 'pressure washing'));
  assert.ok(mentions('Family chiropractic care', 'Chiropractor'));
  assert.ok(!mentions('We build websites', 'roofing'));
  assert.equal(cityName('Hickory, NC 28601'), 'Hickory');
});

test('a healthy site passes the content checks and saves PageSpeed', async () => {
  const f = fakeFetch({
    'https://blueridge.test/robots.txt': { body: 'User-agent: *\nDisallow:\nSitemap: https://blueridge.test/sitemap.xml', type: 'text/plain' },
    'https://blueridge.test/': { body: GOOD_HOME },
    'https://blueridge.test/sitemap.xml': { body: '<?xml version="1.0"?><urlset><url><loc>https://blueridge.test/</loc></url></urlset>', type: 'application/xml' },
    'http://blueridge.test/': { status: 301, location: 'https://blueridge.test/' },
    'https://blueridge.test/services': {}, 'https://blueridge.test/about': {}, 'https://blueridge.test/contact': {}, 'https://blueridge.test/reviews': {}, 'https://blueridge.test/areas': {},
    'https://facebook.test/blueridge': { status: 403 },
  });
  const out = await runAudit(input, { fetch: f, pageSpeedKey: 'k' });
  const c = byKey(out);
  assert.equal(out.checks.length, 13);
  for (const k of ['title', 'meta_description', 'h1', 'keywords', 'image_alt', 'internal_links', 'https', 'sitemap', 'robots', 'broken_links', 'schema', 'mobile']) {
    assert.equal(c[k].status, 'pass', `${k}: ${c[k].summary}`);
  }
  assert.equal(c.page_speed.status, 'warn');
  assert.equal(c.page_speed.score, 0.5);
  assert.equal(c.page_speed.details.mobile.score, 72);
  assert.equal(c.page_speed.details.mobile.screenshot, 'data:image/jpeg;base64,AAAA');
  assert.equal(c.broken_links.details.unverifiable, 1); // the 403 social link is not called broken
});

test('a weak site fails the right checks with plain-English reasons', async () => {
  const f = fakeFetch({
    'https://blueridge.test/': { body: BAD_HOME },
    'https://blueridge.test/sitemap.xml': { body: BAD_HOME }, // SPA-style fallback page, not a sitemap
  });
  const c = byKey(await runAudit(input, { fetch: f, pageSpeedKey: 'k' }));
  assert.equal(c.title.status, 'fail');
  assert.equal(c.meta_description.status, 'fail');
  assert.equal(c.h1.status, 'fail');
  assert.equal(c.keywords.status, 'fail');
  assert.equal(c.image_alt.status, 'fail');
  assert.equal(c.internal_links.status, 'fail');
  assert.equal(c.sitemap.status, 'fail');
  assert.equal(c.robots.status, 'fail');
  assert.equal(c.broken_links.status, 'fail');
  assert.equal(c.schema.status, 'fail');
  assert.equal(c.mobile.status, 'fail');
  assert.match(c.keywords.explanation, /Hickory/);
  for (const check of Object.values(c)) {
    assert.doesNotMatch(check.explanation, /guarantee/i);
    assert.doesNotMatch(check.explanation, /\u2014/); // no em dashes in copy
  }
});

test('failures become skipped, never a crashed audit', async () => {
  const f = fakeFetch({ 'https://blueridge.test/': () => { throw new TypeError('fetch failed'); } }, { psiStatus: 429 });
  const out = await runAudit(input, { fetch: f, pageSpeedKey: '' });
  const c = byKey(out);
  assert.equal(out.checks.length, 13);
  assert.equal(c.title.status, 'skipped');
  assert.equal(c.page_speed.status, 'skipped');
  assert.match(c.page_speed.summary, /API key/);
  assert.equal(c.title.score, null);
});

test('robots.txt that blocks the site is respected: the home page is never fetched', async () => {
  const f = fakeFetch({ 'https://blueridge.test/robots.txt': { body: 'User-agent: *\nDisallow: /', type: 'text/plain' } });
  const c = byKey(await runAudit(input, { fetch: f, pageSpeedKey: 'k' }));
  assert.equal(c.robots.status, 'fail');
  assert.equal(c.title.status, 'skipped');
  assert.ok(!f.calls.some((x) => x.url === 'https://blueridge.test/'));
});

test('a cached PageSpeed result is reused instead of calling Google', async () => {
  const f = fakeFetch({ 'https://blueridge.test/': { body: GOOD_HOME } });
  const cached = { mobile: { score: 95, metrics: [], viewportOk: true }, desktop: { score: 99, metrics: [] } };
  const c = byKey(await runAudit(input, { fetch: f, cachedPageSpeed: async () => cached }));
  assert.equal(c.page_speed.status, 'pass');
  assert.equal(c.page_speed.details.cached, true);
  assert.ok(!f.calls.some((x) => x.url.includes('googleapis')));
});
