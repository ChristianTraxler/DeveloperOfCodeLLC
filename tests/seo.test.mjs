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

// ── Phase 2: scoring and Next Steps ─────────────────────────────────────────
import { scoreAudit, buildTasks } from '../api/_lib/seo-score.mjs';

const results = (statuses) =>
  Object.entries(statuses).map(([key, status]) => ({ key, category: CHECKS[key].category, status, score: STATUS_POINTS[status] }));

test('score matches a hand calculation: weak site, visibility dropped', () => {
  // On-page: title 1, meta 0.5, h1 1, keywords 0, image_alt 1 (internal_links skipped) = 3.5 / 5 = 70
  // Technical: 1 + 1 + 0.5 + 0 + 1 + 1 = 4.5 / 6 = 75
  // Local: schema 0 = 0. Visibility has no data and drops out.
  // Weights 25, 25, 30 rescale to 31.25, 31.25, 37.5.
  // Overall = 70 * 0.3125 + 75 * 0.3125 + 0 * 0.375 = 45.3125, rounds to 45.
  const s = scoreAudit(results({
    title: 'pass', meta_description: 'warn', h1: 'pass', keywords: 'fail', image_alt: 'pass', internal_links: 'skipped',
    https: 'pass', mobile: 'pass', page_speed: 'warn', sitemap: 'fail', robots: 'pass', broken_links: 'pass',
    schema: 'fail',
  }));
  assert.equal(s.overall, 45);
  assert.equal(s.categories.onpage.score, 70);
  assert.equal(s.categories.technical.score, 75);
  assert.equal(s.categories.local.score, 0);
  assert.equal(s.categories.visibility.score, null);
  assert.deepEqual(s.dropped, ['visibility']);
  assert.equal(s.categories.local.weight, 37.5);
});

test('score matches a hand calculation: strong site, skipped speed', () => {
  // On-page all pass = 100. Technical: 1 + 0.5 + 0 + 1 + 1 (broken_links skipped) = 3.5 / 5 = 70.
  // Local: schema 1 = 100. Overall = 100 * 0.3125 + 70 * 0.3125 + 100 * 0.375 = 90.625, rounds to 91.
  const s = scoreAudit(results({
    title: 'pass', meta_description: 'pass', h1: 'pass', keywords: 'pass', image_alt: 'pass', internal_links: 'pass',
    https: 'pass', mobile: 'warn', page_speed: 'fail', sitemap: 'pass', robots: 'pass', broken_links: 'skipped',
    schema: 'pass',
  }));
  assert.equal(s.overall, 91);
  assert.equal(s.categories.technical.score, 70);
});

test('weights are not rescaled when every category has data', () => {
  // 100 * 0.25 + 0 * 0.25 + 100 * 0.30 + 50 * 0.20 = 65
  const s = scoreAudit(results({ title: 'pass', https: 'fail', schema: 'pass', rank: 'warn' }));
  assert.equal(s.overall, 65);
  assert.deepEqual(s.dropped, []);
  assert.equal(s.categories.visibility.weight, 20);
});

test('a review with nothing scored has no overall score', () => {
  const s = scoreAudit(results({ title: 'skipped', https: 'skipped' }));
  assert.equal(s.overall, null);
  assert.equal(Object.keys(CATEGORIES).length, s.dropped.length);
});

test('Next Steps: only fails and warns, high impact, then small effort, then fail before warn', () => {
  const tasks = buildTasks(results({
    title: 'warn', meta_description: 'fail', keywords: 'fail', image_alt: 'fail', https: 'pass',
    mobile: 'fail', sitemap: 'skipped', schema: 'fail', page_speed: 'warn',
  }));
  assert.deepEqual(tasks.map((t) => t.checkKey), [
    'schema', // high, small, fail
    'title', // high, small, warn
    'keywords', // high, medium, fail
    'page_speed', // high, medium, warn
    'mobile', // high, large
    'meta_description', // medium, small
    'image_alt', // low
  ]);
  assert.deepEqual(tasks.map((t) => t.priorityOrder), [1, 2, 3, 4, 5, 6, 7]);
  for (const t of tasks) {
    assert.ok(t.title && !/[—–]/.test(t.title), `${t.checkKey} has a plain title`);
    assert.ok(t.serviceTag, `${t.checkKey} links to a service`);
  }
});

test('every check has a Next Steps title', () => {
  for (const [key, c] of Object.entries(CHECKS)) assert.ok(c.task, `${key} needs a task title in seo-config.mjs`);
});

test('the client share view leaks no ids, tokens, notes or raw details', async () => {
  process.env.SUPABASE_URL ||= 'https://sb.test';
  const { shareView } = await import('../api/seo.mjs');
  const audit = { id: 'a1b2', share_token: 'secret-token-value-123', lead_id: 'lead-9', notes: { site: { ip: '1.2.3.4' } }, business_name: 'Blue Ridge Wash', site_url: 'https://www.blueridge.test/', final_url: null, city: 'Hickory, NC', service: 'Pressure washing', created_at: '2026-10-15T12:00:00Z', reviewed_at: '2026-10-15T13:00:00Z', overall_score: 45, status: 'complete' };
  const checkRows = [
    { id: 11, audit_id: 'a1b2', check_key: 'title', category: 'onpage', status: 'fail', score: 0, summary: 'No city', explanation: 'Plain words.', details: { html: '<title>x</title>' } },
    { id: 12, audit_id: 'a1b2', check_key: 'page_speed', category: 'technical', status: 'warn', score: 0.5, summary: 'Slow', explanation: 'Plain.', details: { mobile: { score: 62, screenshot: 'data:image/jpeg;base64,AAAA' }, desktop: { score: 91 } } },
  ];
  const taskRows = [{ id: 5, audit_id: 'a1b2', check_id: 11, title: 'Add the city', impact: 'high', effort: 'small', service_tag: 'onpage', priority_order: 1, done: false }];
  checkRows.push({ id: 13, audit_id: 'a1b2', check_key: 'gbp', category: 'local', status: 'pass', score: 1, summary: 'ok', explanation: 'Plain.', details: { found: true, has: { hours: true }, category: 'Pressure washing service', photos: 4, mapsUrl: 'https://maps.google.test/?cid=999', address: '1 Main St' } });
  const comps = [
    { id: 77, name: 'Shine Bros', site_url: 'https://www.shine.test/', place_id: 'ChIJsecretplace', status: 'complete', scores: { overall: 81, place: { rating: 4.9, reviews: 120, address: '9 Oak Ave' }, statuses: { title: 'pass', bogus: 'x' } } },
    { id: 78, name: 'Pending Co', site_url: null, place_id: 'ChIJother', status: 'pending', scores: {} },
  ];
  const v = shareView(audit, checkRows, taskRows, comps);
  const text = JSON.stringify(v);
  for (const leak of ['a1b2', 'secret-token', 'lead-9', '1.2.3.4', 'base64', '<title>', 'ChIJ', 'maps.google', '1 Main St', '9 Oak Ave']) assert.ok(!text.includes(leak), `share view leaks ${leak}`);
  assert.deepEqual(v.local.competitors, [{ name: 'Shine Bros', site: 'shine.test', overall: 81, rating: 4.9, reviews: 120, statuses: { title: 'pass' } }]);
  assert.equal(v.local.gbp.category, 'Pressure washing service');
  assert.equal(v.report.site, 'blueridge.test');
  assert.deepEqual(v.report.speed, { phone: 62, computer: 91 });
  assert.equal(v.tasks[0].status, 'fail');
  assert.equal(v.tasks[0].service, 'On-page fixes');
  assert.equal(v.recommended, 'implementation');
});

// ── Phase 3: local layer ────────────────────────────────────────────────────
import { findLocal, localChecks, placeStatuses, rankCheck, competitorsCheck, compareNap } from '../api/_lib/seo-local.mjs';
import { siteFacts } from '../api/_lib/seo-checks.mjs';

const place = (over = {}) => ({
  id: over.id || 'p1',
  displayName: { text: over.name || 'Blue Ridge Wash' },
  formattedAddress: '1 Main St, Hickory, NC 28601, USA',
  addressComponents: [
    { shortText: '1', types: ['street_number'] },
    { shortText: 'Main St', types: ['route'] },
    { shortText: '28601', types: ['postal_code'] },
  ],
  nationalPhoneNumber: '(828) 555-0100',
  websiteUri: over.website ?? 'https://blueridge.test/',
  rating: over.rating ?? 4.8,
  userRatingCount: over.reviews ?? 42,
  regularOpeningHours: over.hours === false ? undefined : { weekdayDescriptions: ['Monday: 8 AM to 5 PM'] },
  photos: over.photos === 0 ? [] : [{}, {}],
  primaryTypeDisplayName: over.category === false ? undefined : { text: 'Pressure washing service' },
  businessStatus: 'OPERATIONAL',
});

function placesFetch(answers) {
  const calls = [];
  const fn = async (url, init) => {
    const q = JSON.parse(init.body).textQuery;
    calls.push(q);
    return new Response(JSON.stringify({ places: answers[q] || [] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  fn.calls = calls;
  return fn;
}

const COMPS = [place({ id: 'c1', name: 'Shine Bros', website: 'https://shine.test', reviews: 120, rating: 4.9 }), place({ id: 'c2', name: 'Hickory Clean', website: 'https://hc.test', reviews: 60 }), place({ id: 'c3', name: 'Wash Pros', website: '', reviews: 8, rating: 4.2 })];
const localInput = { business: 'Blue Ridge Wash', city: 'Hickory, NC', service: 'Pressure washing', siteUrl: 'https://blueridge.test/' };

test('findLocal: finds the client by website, its map position, and the top 3 competitors in one call', async () => {
  const f = placesFetch({ 'Pressure washing in Hickory, NC': [COMPS[0], place(), COMPS[1], COMPS[2], place({ id: 'c4', name: 'Fourth' })] });
  const store = new Map();
  const cache = { get: async (k) => store.get(k) ?? null, set: async (k, v) => store.set(k, v) };
  const out = await findLocal(localInput, { fetch: f, key: 'k', cache });
  assert.equal(out.place.placeId, 'p1');
  assert.equal(out.position, 2);
  assert.deepEqual(out.competitors.map((c) => [c.name, c.position]), [['Shine Bros', 1], ['Hickory Clean', 3], ['Wash Pros', 4]]);
  assert.equal(out.calls, 1);
  assert.ok(store.has('place:c1'), 'places cached by place_id');
  const again = await findLocal(localInput, { fetch: f, key: 'k', cache });
  assert.equal(again.calls, 0, 'second review reads the cache');
  assert.equal(f.calls.length, 1);
});

test('findLocal: a second search by name only when the first misses, never more than 2 calls', async () => {
  const f = placesFetch({ 'Pressure washing in Hickory, NC': COMPS, 'Blue Ridge Wash Hickory, NC': [place({ website: '' })] });
  const out = await findLocal(localInput, { fetch: f, key: 'k' });
  assert.equal(out.place.placeId, 'p1');
  assert.equal(out.position, null);
  assert.equal(out.calls, 2);
  const none = await findLocal(localInput, { fetch: placesFetch({}), key: 'k' });
  assert.equal(none.place, null);
  assert.equal(none.calls, 2);
});

test('local checks: no key or a Places error saves them as skipped', async () => {
  const off = localChecks(await findLocal(localInput, {}), null, localInput);
  assert.deepEqual(off.map((c) => c.status), ['skipped', 'skipped', 'skipped']);
  const broken = await findLocal(localInput, { key: 'k', fetch: async () => new Response('{"error":{"message":"API key not valid"}}', { status: 400 }) });
  const c = localChecks(broken, null, localInput);
  assert.ok(c.every((x) => x.status === 'skipped' && /API key not valid/.test(x.summary)));
});

test('local checks: complete profile, review grades and the brief thresholds', async () => {
  const f = placesFetch({ 'Pressure washing in Hickory, NC': [place(), ...COMPS] });
  const local = await findLocal(localInput, { fetch: f, key: 'k' });
  const facts = siteFacts(readPage(GOOD_HOME));
  const [gbp, reviews, nap] = localChecks(local, facts, localInput);
  assert.equal(gbp.status, 'pass');
  assert.equal(reviews.status, 'pass');
  assert.match(reviews.explanation, /average 63 reviews/);
  assert.equal(nap.status, 'pass', JSON.stringify(nap.details));
  assert.deepEqual(placeStatuses(compactOf(place({ reviews: 9 }))), { gbp: 'pass', reviews: 'fail' });
  assert.equal(placeStatuses(compactOf(place({ rating: 3.9, reviews: 200 }))).reviews, 'fail');
  assert.equal(placeStatuses(compactOf(place({ reviews: 12 }))).reviews, 'warn');
  assert.equal(placeStatuses(compactOf(place({ hours: false }))).gbp, 'fail');
  assert.equal(placeStatuses(compactOf(place({ photos: 0 }))).gbp, 'fail');
});

function compactOf(p) {
  return { name: p.displayName.text, hours: p.regularOpeningHours?.weekdayDescriptions || [], photos: p.photos.length, website: p.websiteUri, category: p.primaryTypeDisplayName?.text, rating: p.rating, reviews: p.userRatingCount, status: p.businessStatus };
}

test('NAP: a different phone and a missing address are caught; no profile skips', async () => {
  const facts = siteFacts(readPage(BAD_HOME.replace('Welcome', 'Welcome to Blue Ridge Wash. Call 828-555-0199')));
  assert.deepEqual(facts.phones, ['8285550199']);
  const local = await findLocal(localInput, { fetch: placesFetch({ 'Pressure washing in Hickory, NC': [place()] }), key: 'k' });
  const items = compareNap(local.place, facts, localInput.siteUrl);
  assert.deepEqual(items.map((i) => [i.key, i.ok]), [['name', true], ['phone', false], ['address', false], ['website', true]]);
  assert.equal(localChecks(local, facts, localInput)[2].status, 'fail');
  const missing = await findLocal(localInput, { fetch: placesFetch({}), key: 'k' });
  const [gbp, reviews, nap] = localChecks(missing, facts, localInput);
  assert.equal(gbp.status, 'fail');
  assert.equal(reviews.status, 'skipped');
  assert.equal(nap.status, 'skipped');
});

test('rank: top 3 works, 4 to 10 tightens, past 10 or not found fails', () => {
  assert.equal(rankCheck('pressure washing hickory', 2).status, 'pass');
  assert.equal(rankCheck('pressure washing hickory', 7).status, 'warn');
  assert.equal(rankCheck('pressure washing hickory', 14).status, 'fail');
  assert.equal(rankCheck('pressure washing hickory', null).status, 'fail');
});

test('competitors: fails when most competitors beat the client on most checks', () => {
  const keys = ['title', 'meta_description', 'h1', 'keywords', 'https', 'sitemap', 'schema', 'reviews'];
  const all = (s) => Object.fromEntries(keys.map((k) => [k, s]));
  const strong = { name: 'A', statuses: all('pass') };
  const weak = { name: 'B', statuses: all('fail') };
  assert.equal(competitorsCheck(all('fail'), [strong, strong, weak]).status, 'fail');
  assert.equal(competitorsCheck(all('pass'), [strong, strong, weak]).status, 'pass');
  const mixed = { ...all('pass'), title: 'fail', h1: 'fail' };
  const c = competitorsCheck(mixed, [strong, strong, weak]);
  assert.equal(c.status, 'warn');
  assert.deepEqual(c.details.behind, ['title', 'h1']);
  assert.equal(competitorsCheck(all('pass'), [{ name: 'X', statuses: {} }]).status, 'skipped');
  for (const x of [c, rankCheck('x', null)]) assert.ok(!/—/.test(x.explanation));
});

test('runAudit saves name, address and phone facts from the home page', async () => {
  const f = fakeFetch({
    'https://blueridge.test/robots.txt': { body: 'User-agent: *\nAllow: /', type: 'text/plain' },
    'https://blueridge.test/': { body: GOOD_HOME },
  });
  const out = await runAudit(input, { fetch: f, pageSpeedKey: '' });
  assert.equal(out.site.nap.schemaName, 'Blue Ridge Wash');
  assert.deepEqual(out.site.nap.phones, ['8285550100']);
  assert.match(out.site.nap.schemaAddress, /1 Main St/);
});

test('private address guard: IPv4 wrapped in IPv6 and odd schemes are refused', async () => {
  const { isPublicUrl, setHostGuard: set } = await import('../api/_lib/seo-checks.mjs');
  set(null);
  for (const u of ['http://127.0.0.1/', 'http://[::ffff:127.0.0.1]/', 'http://[::ffff:7f00:1]/', 'http://[64:ff9b::a00:1]/', 'http://[fe80::1]/', 'http://[::1]/', 'http://169.254.169.254/latest', 'javascript:alert(1)', 'file:///etc/passwd', 'http://localhost/'])
    assert.equal(await isPublicUrl(u), false, u);
  assert.equal(await isPublicUrl('http://8.8.8.8/'), true);
  set(async () => {});
});

test('Places links that are not http(s) are dropped', async () => {
  const f = placesFetch({ 'Pressure washing in Hickory, NC': [place({ website: 'javascript:alert(1)' }), { ...place({ id: 'z', name: 'Zed' }), googleMapsUri: 'javascript:x' }] });
  const out = await findLocal(localInput, { fetch: f, key: 'k' });
  assert.ok(out.candidates.every((c) => c.website == null || /^https?:/.test(c.website)));
  assert.ok(out.candidates.every((c) => c.mapsUrl == null || /^https?:/.test(c.mapsUrl)));
});
