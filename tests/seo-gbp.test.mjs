// Run with: npm run test:seo
// The Google profile typed in by hand, with no Google Places key (no Google billing account).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installFakes } from './seo-fakes.mjs';

process.env.SUPABASE_URL = 'https://sb.test';
process.env.SUPABASE_ANON_KEY = 'anon';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
process.env.ADMIN_EMAILS = 'owner@example.test';
process.env.GOOGLE_PLACES_API_KEY = '';
process.env.PAGESPEED_API_KEY = '';

const { setHostGuard } = await import('../api/_lib/seo-checks.mjs');
const { default: api } = await import('../api/seo.mjs');
const { parseMapsLink, manualPlace, addressParts } = await import('../api/_lib/seo-gbp.mjs');
const { buildFixReport } = await import('../api/_lib/seo-fixreport.mjs');
setHostGuard(async () => {});
const { db, stats } = installFakes();

async function call(action, body, query = '') {
  const res = await api.fetch(new Request(`https://site.test/api/seo?action=${action}${query}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }));
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error), { status: res.status });
  return data;
}
const byKey = (checks) => Object.fromEntries(checks.map((c) => [c.key, c]));
const input = { url: 'blueridge.test', business: 'Blue Ridge Wash', city: 'Hickory, NC', service: 'Pressure washing' };
const profile = { name: 'Blue Ridge Wash', address: '1 Main St, Hickory, NC 28601', phone: '(828) 555-0100', website: 'blueridge.test', category: 'Pressure washing service', rating: '4.8', reviews: '31', photos: '12', hoursListed: true };

test('maps links: which links are accepted and what is read from them', () => {
  assert.equal(parseMapsLink('https://www.google.com/maps/place/Blue+Ridge+Wash/@35.7,-81.3,17z').name, 'Blue Ridge Wash');
  assert.equal(parseMapsLink('maps.app.goo.gl/abc123').short, true);
  assert.equal(parseMapsLink('https://share.google/xyz').short, true);
  assert.equal(parseMapsLink('https://www.google.com/search?q=Blue%20Ridge%20Wash%20Hickory').name, 'Blue Ridge Wash Hickory');
  assert.throws(() => parseMapsLink('https://evil.test/maps/place/x'), /Google Maps/);
  assert.throws(() => parseMapsLink('https://www.google.com/mail'), /Google Maps/);
  assert.throws(() => parseMapsLink('https://goo.gl/abc'), /not a Google Maps/);
  assert.equal(parseMapsLink(''), null);
  assert.deepEqual(addressParts('120 N Center St, Hickory, NC 28601-1234'), { streetNumber: '120', route: 'N Center St', postalCode: '28601' });
  assert.throws(() => manualPlace({ name: 'X', rating: '6' }), /1\.0 to 5\.0/);
  assert.throws(() => manualPlace({ name: 'X', reviews: '3.5' }), /whole number/);
  assert.throws(() => manualPlace({}), /business name/);
  assert.equal(manualPlace({ name: 'X', reviews: '0', rating: '5' }).rating, null, 'no reviews, no rating');
});

test('no Places key: type the profile in, the local checks run, and the next review reuses it', async () => {
  const run = await call('run', { ...input, gbpLink: 'https://maps.app.goo.gl/abc123' });
  const id = run.audit.id;
  let c = byKey(run.checks);
  for (const k of ['gbp', 'reviews', 'nap']) assert.equal(c[k].status, 'skipped');
  assert.equal(run.audit.notes.local.link.name, 'Blue Ridge Wash', 'the short link was followed to the full Maps link');
  assert.match(run.audit.notes.local.link.url, /^https:\/\/www\.google\.com\/maps\/place\//);

  // A short link that leaves Google is kept as the short link, never followed off Google.
  const evil = await call('mapsLink', { url: 'https://maps.app.goo.gl/evil' });
  assert.equal(evil.resolved, false);
  assert.equal(evil.url, 'https://maps.app.goo.gl/evil');
  await assert.rejects(call('mapsLink', { url: 'https://evil.test/' }), /Google Maps/);

  await assert.rejects(call('profile', { id, ...profile, rating: 'abc' }), /1\.0 to 5\.0/);
  const saved = await call('profile', { id, ...profile });
  c = byKey(saved.checks);
  assert.equal(c.gbp.status, 'pass', c.gbp.summary);
  assert.equal(c.gbp.details.manual, true);
  assert.equal(c.gbp.details.mapsUrl, run.audit.notes.local.link.url);
  assert.equal(c.reviews.status, 'pass', c.reviews.summary);
  assert.equal(c.nap.status, 'pass', JSON.stringify(c.nap.details));
  assert.ok(saved.audit.category_scores.local.score > 0);
  assert.ok(saved.audit.notes.local.manual.enteredAt);
  assert.equal(stats.placesCalls, 0, 'never called Google Places');

  // Missing photos and few reviews: the profile and reviews checks say so.
  const thin = byKey((await call('profile', { id, ...profile, photos: '0', reviews: '4', rating: '5' })).checks);
  assert.equal(thin.gbp.status, 'fail');
  assert.match(thin.gbp.summary, /photos/);
  assert.equal(thin.reviews.status, 'fail');

  // The fix-it report hands Claude the typed phone and address.
  await call('profile', { id, ...profile, hours: 'Monday: 8 AM to 5 PM\nTuesday: 8 AM to 5 PM' });
  const md = buildFixReport(await call('get', null, `&id=${id}`));
  assert.match(md, /Phone: \(828\) 555-0100/);
  assert.match(md, /Hours: Monday: 8 AM to 5 PM; Tuesday: 8 AM to 5 PM/);

  // Run it again: the typed profile carries over.
  const again = byKey((await call('run', input)).checks);
  assert.equal(again.gbp.status, 'pass');
  assert.equal(again.gbp.details.manual, true);

  // "No profile" is a fail for gbp, and reviews are skipped.
  const none = byKey((await call('profile', { id, none: true })).checks);
  assert.equal(none.gbp.status, 'fail');
  assert.equal(none.reviews.status, 'skipped');
  assert.ok(db.seo_audits.length >= 2);
});
