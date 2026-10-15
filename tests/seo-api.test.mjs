// Run with: npm run test:seo
// The whole Phase 3 flow through api/seo.mjs, with no network: a small in-memory stand-in for
// Supabase's REST API, made-up Google Places answers, and made-up sites.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installFakes } from './seo-fakes.mjs';

process.env.SUPABASE_URL = 'https://sb.test';
process.env.SUPABASE_ANON_KEY = 'anon';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
process.env.ADMIN_EMAILS = 'owner@example.test';
process.env.GOOGLE_PLACES_API_KEY = 'places-key';
process.env.PAGESPEED_API_KEY = '';

const { setHostGuard } = await import('../api/_lib/seo-checks.mjs');
const { default: api } = await import('../api/seo.mjs');
setHostGuard(async () => {});

const { db, stats } = installFakes();

async function call(action, body, query = '') {
  const req = new Request(`https://site.test/api/seo?action=${action}${query}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const res = await api.fetch(req);
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error), { status: res.status });
  return data;
}
const byKey = (checks) => Object.fromEntries(checks.map((c) => [c.key, c]));

test('Phase 3 end to end: places, competitors, compare, rank, re-pick and share', async () => {
  const run = await call('run', { url: 'blueridge.test', business: 'Blue Ridge Wash', city: 'Hickory, NC', service: 'Pressure washing' });
  const id = run.audit.id;
  let c = byKey(run.checks);
  assert.equal(c.gbp.status, 'pass');
  assert.equal(c.reviews.status, 'warn', '18 reviews is under 25');
  assert.equal(c.nap.status, 'pass', JSON.stringify(c.nap.details));
  assert.equal(c.gbp.details.position, 2);
  assert.equal(stats.placesCalls, 1);
  assert.deepEqual(run.competitors.map((x) => [x.name, x.status, x.position]), [['Shine Bros', 'pending', 1], ['Hickory Clean', 'pending', 3], ['Wash Pros', 'pending', 4]]);
  assert.equal(run.audit.notes.local.placeId, 'pClient');

  // Each competitor runs in its own call, then compare scores the client against them.
  for (const comp of run.competitors) {
    const out = await call('competitor', { id, competitorId: comp.id });
    assert.equal(out.competitor.status, 'complete');
  }
  const wash = db.seo_audit_competitors.find((x) => x.name === 'Wash Pros');
  assert.deepEqual(wash.scores.statuses, { gbp: 'fail', reviews: 'fail' }, 'no website: graded on the Google listing only');
  assert.equal(wash.scores.overall, null, 'no site checks, so no score to compare');
  const shine = db.seo_audit_competitors.find((x) => x.name === 'Shine Bros');
  assert.equal(shine.scores.statuses.title, 'pass');
  assert.ok(shine.scores.overall > 0);

  const compared = await call('compare', { id });
  c = byKey(compared.checks);
  assert.ok(['warn', 'fail'].includes(c.competitors.status), c.competitors.summary);
  assert.ok(c.competitors.details.behind.includes('title'));
  assert.equal(compared.audit.category_scores.visibility.score, c.competitors.status === 'fail' ? 0 : 50);
  assert.ok(compared.tasks.some((t) => t.checkKey === 'competitors'));

  // Tick a task, enter the rank, and the tick survives the rebuilt Next Steps.
  const titleTask = compared.tasks.find((t) => t.checkKey === 'title');
  await call('task', { id: titleTask.id, done: true });
  const ranked = await call('rank', { id, position: 7 });
  c = byKey(ranked.checks);
  assert.equal(c.rank.status, 'warn');
  assert.equal(c.rank.details.keyword, 'pressure washing hickory');
  assert.equal(ranked.ranks[0].rank_position, 7);
  assert.equal(ranked.tasks.find((t) => t.checkKey === 'title').done, true);
  await assert.rejects(call('rank', { id, position: 0 }), /1 to 100/);

  // Too many competitors, and the client itself, are refused.
  await assert.rejects(call('competitorAdd', { id, name: 'Extra', url: 'extra.test' }), /up to 3/);
  await assert.rejects(call('competitorAdd', { id, name: 'Me', url: 'blueridge.test' }), /being reviewed/);

  // Share: reviewed only, with the local section.
  await call('review', { id, reviewed: true });
  const token = db.seo_audits.find((a) => a.id === id).share_token;
  const shared = await (await api.fetch(new Request(`https://site.test/api/seo?action=share&t=${token}`))).json();
  assert.equal(shared.local.competitors.length, 3);
  assert.equal(shared.local.rank.position, 7);
  assert.equal(shared.local.gbp.category, 'Pressure washing service');
  assert.ok(!JSON.stringify(shared).includes('pClient'));

  // The owner says the match was wrong: no profile. Costs no Places calls.
  const before = stats.placesCalls;
  const none = await call('place', { id, placeId: 'none' });
  c = byKey(none.checks);
  assert.equal(c.gbp.status, 'fail');
  assert.equal(c.reviews.status, 'skipped');
  assert.equal(stats.placesCalls, before);
  assert.equal(none.competitors.length, 3, 'competitors found again from the cached search');
  assert.ok(none.competitors.every((x) => x.status === 'pending'));

  // Pick it back, then remove a competitor: compare runs again on what is left.
  const back = await call('place', { id, placeId: 'pClient' });
  assert.equal(byKey(back.checks).gbp.status, 'pass');
  assert.equal(back.competitors.filter((x) => x.name === 'Blue Ridge Wash').length, 0);
  const removed = await call('competitorRemove', { id, competitorId: back.competitors[0].id });
  assert.equal(removed.competitors.length, 2);
  assert.ok(!byKey(removed.checks).competitors, 'no finished competitors left, so no competitors check');
});

test('without a Places key the local checks are skipped and competitors can be added by hand', async () => {
  // Same module, so flip the key off by running a review whose search fails instead.
  const saved = globalThis.fetch;
  globalThis.fetch = async (url, init) => (String(url).startsWith('https://places.googleapis.com') ? new Response('{"error":{"message":"API key not valid"}}', { status: 400 }) : saved(url, init));
  try {
    // A different search, so the cached answer from the first test is not reused.
    const run = await call('run', { url: 'blueridge.test', business: 'Blue Ridge Wash', city: 'Newton, NC', service: 'Pressure washing' });
    const c = byKey(run.checks);
    for (const k of ['gbp', 'reviews', 'nap']) assert.equal(c[k].status, 'skipped');
    assert.equal(run.competitors.length, 0);
    const added = await call('competitorAdd', { id: run.audit.id, name: 'Shine Bros', url: 'shine.test' });
    assert.equal(added.competitor.manual, true);
    await call('competitor', { id: run.audit.id, competitorId: added.competitor.id });
    const out = await call('compare', { id: run.audit.id });
    assert.ok(byKey(out.checks).competitors);
  } finally {
    globalThis.fetch = saved;
  }
});
