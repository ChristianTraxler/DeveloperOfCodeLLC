// api/seo.mjs: backend for /admin/seo/ (SEO Review), one function with an ?action= switch.
//
// Public action (no sign in, used by the client report at /seo/<share_token>):
//   GET  share&t=<token> one reviewed review, shaped for the client. Never ids, tokens, notes,
//                        raw check details or anything about other reviews.
//
// Admin actions (need a Supabase session whose email is in ADMIN_EMAILS):
//   GET  list            every review, newest first, without the check details
//   GET  get&id=<uuid>   one review with all of its checks
//   GET  meta            check labels, categories and services from api/_lib/seo-config.mjs
//   POST run             { url, business, city, service, fresh? } runs the checks and saves them
//   POST review          { id, reviewed } sets or clears reviewed_at (only reviewed reviews will share)
//   POST task            { id, done } ticks a Next Steps task
//   POST delete          { id }
//
// Phase 3, the local layer (api/_lib/seo-local.mjs):
//   run also looks the business up on Google Places, saves gbp, reviews and nap, and lists the
//   top 3 competitors as pending rows. Their checks run one per call afterwards, so each fits
//   inside Vercel's 60 seconds:
//   POST competitor      { id, competitorId } runs the checks on one competitor's site
//   POST compare         { id } scores the client against the finished competitors
//   POST competitorAdd   { id, name, url } adds one by hand (needed when Places is not set up)
//   POST competitorRemove{ id, competitorId }
//   POST place           { id, placeId | 'none' } picks the right Google listing when the match was wrong
//   POST rank            { id, position | null, keyword? } the manual rank entry (null: not in the top 10)
//
// Scores and Next Steps (api/_lib/seo-score.mjs) are written on run. Reviews saved before
// Phase 2 get theirs the first time they are read.
//
// Env vars (server only):
//   SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAILS   same as api/marketing.mjs and api/demos.mjs
//   PAGESPEED_API_KEY                         Google PageSpeed Insights API key (free)
//   GOOGLE_PLACES_API_KEY                     Google Places API (New) key (free allowance, then paid)
//
// The checks themselves live in api/_lib/seo-checks.mjs and every threshold in seo-config.mjs.

import { randomBytes } from 'node:crypto';
import { AuditInputError, normalizeUrl, runAudit, PHASE_ONE } from './_lib/seo-checks.mjs';
import { CATEGORIES, CHECKS, SERVICES, FETCH, OFFERS, BRAND, LOCAL } from './_lib/seo-config.mjs';
import { scoreAudit, buildTasks } from './_lib/seo-score.mjs';
import { findLocal, localChecks, placeStatuses, rankCheck, competitorsCheck, hostOf } from './_lib/seo-local.mjs';
import { cityName } from './_lib/seo-html.mjs';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const PAGESPEED_KEY = process.env.PAGESPEED_API_KEY || '';
const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY || '';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AUDIT_COLUMNS = 'id,lead_id,site_url,final_url,business_name,city,service,overall_score,category_scores,status,error,notes,duration_ms,created_at,reviewed_at';
const ADMIN_AUDIT_COLUMNS = `${AUDIT_COLUMNS},share_token`;

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// ── Supabase (plain fetch, no SDK), same shape as api/marketing.mjs ─────────

async function requireAdmin(request) {
  const token = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') || '')?.[1];
  if (!token) throw new HttpError(401, 'Sign in first.');
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new HttpError(401, 'Your session expired. Sign in again.');
  const user = await res.json();
  if (!user?.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) throw new HttpError(403, 'This account is not allowed to use SEO Review.');
  return user;
}

async function sb(path, init = {}) {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new HttpError(500, 'The server is missing SUPABASE_SERVICE_ROLE_KEY. Add it in Vercel.');
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, ...init.headers },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    if (res.status === 404 && /relation|does not exist|schema cache/i.test(detail)) throw new HttpError(500, 'The SEO Review tables are not in Supabase yet. Run supabase/seo.sql in the SQL Editor.');
    throw new Error(`Supabase ${init.method || 'GET'} ${path.split('?')[0]} failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  return res;
}
const rows = async (path) => (await sb(path)).json();
const insert = async (table, body) =>
  (await sb(`/rest/v1/${table}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(body) })).json();
const patch = (table, filter, body) =>
  sb(`/rest/v1/${table}?${filter}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(body) });
const enc = encodeURIComponent;

// ── Shaping ─────────────────────────────────────────────────────────────────

// Per-category counts plus the Phase 2 score and rescaled weight. checks use { key, category, status, score }.
function categoryScores(checks) {
  const scored = scoreAudit(checks);
  const out = {};
  for (const key of Object.keys(CATEGORIES)) out[key] = { pass: 0, warn: 0, fail: 0, skipped: 0, notRun: 0, ...scored.categories[key] };
  const ran = new Set(checks.map((c) => c.key));
  for (const c of checks) out[c.category][c.status]++;
  for (const [k, m] of Object.entries(CHECKS)) if (!ran.has(k)) out[m.category].notRun++;
  return { overall: scored.overall, categories: out };
}

// Saved check rows (check_key, id) to Next Steps rows.
const taskRows = (auditId, savedChecks) => {
  const ids = Object.fromEntries(savedChecks.map((r) => [r.check_key, r.id]));
  return buildTasks(savedChecks.map((r) => ({ key: r.check_key, category: r.category, status: r.status }))).map((t) => ({
    audit_id: auditId,
    check_id: ids[t.checkKey] ?? null,
    title: t.title,
    impact: t.impact,
    effort: t.effort,
    service_tag: t.serviceTag,
    priority_order: t.priorityOrder,
  }));
};

const checkRow = (auditId) => (c) => ({
  audit_id: auditId,
  category: c.category,
  check_key: c.key,
  status: c.status,
  score: c.score,
  summary: c.summary,
  explanation: c.explanation,
  details: c.details,
});

function toCheck(row) {
  const meta = CHECKS[row.check_key] || {};
  return {
    key: row.check_key,
    category: row.category,
    label: meta.label || row.check_key,
    status: row.status,
    score: row.score == null ? null : Number(row.score),
    summary: row.summary,
    explanation: row.explanation,
    impact: meta.impact,
    effort: meta.effort,
    service: SERVICES[meta.service],
    details: row.details || {},
  };
}

function toTask(row, checkKeys) {
  return {
    id: row.id,
    checkKey: checkKeys[row.check_id] || null,
    title: row.title,
    impact: row.impact,
    effort: row.effort,
    service: SERVICES[row.service_tag] || row.service_tag,
    priorityOrder: row.priority_order,
    done: row.done,
  };
}

export const meta = () => ({
  categories: CATEGORIES,
  checks: Object.fromEntries(Object.entries(CHECKS).map(([k, v]) => [k, { ...v, service: SERVICES[v.service] }])),
  phaseOne: PHASE_ONE,
  pageSpeedKey: !!PAGESPEED_KEY,
  placesKey: !!PLACES_KEY,
  maxCompetitors: LOCAL.competitors,
});

// ── Actions ─────────────────────────────────────────────────────────────────

// Reviews saved before Phase 2 have no score. Score them from their saved checks, write it back,
// and create their Next Steps if they have none. Mutates audit so the caller returns fresh values.
async function backfill(audit, savedChecks, hasTasks) {
  if (audit.status !== 'complete' || audit.overall_score != null || !savedChecks.length) return;
  const scored = categoryScores(savedChecks.map((r) => ({ key: r.check_key, category: r.category, status: r.status, score: r.score == null ? null : Number(r.score) })));
  audit.overall_score = scored.overall;
  audit.category_scores = scored.categories;
  await patch('seo_audits', `id=eq.${audit.id}`, { overall_score: scored.overall, category_scores: scored.categories });
  if (!hasTasks) {
    const tasks = taskRows(audit.id, savedChecks);
    if (tasks.length) await insert('seo_audit_tasks', tasks);
  }
}

const BACKFILL_PER_LIST = 25;

async function list() {
  const audits = await rows(`/rest/v1/seo_audits?select=${AUDIT_COLUMNS}&order=created_at.desc&limit=500`);
  const stale = audits.filter((a) => a.status === 'complete' && a.overall_score == null).slice(0, BACKFILL_PER_LIST);
  if (stale.length) {
    const ids = stale.map((a) => a.id).join(',');
    const [checks, tasks] = await Promise.all([
      rows(`/rest/v1/seo_audit_checks?audit_id=in.(${ids})&select=id,audit_id,category,check_key,status,score`),
      rows(`/rest/v1/seo_audit_tasks?audit_id=in.(${ids})&select=audit_id`),
    ]);
    for (const a of stale) await backfill(a, checks.filter((c) => c.audit_id === a.id), tasks.some((t) => t.audit_id === a.id));
  }
  return { audits, meta: meta() };
}

async function getOne(id) {
  if (!UUID.test(id || '')) throw new HttpError(400, 'That review id is not valid.');
  const [audit] = await rows(`/rest/v1/seo_audits?id=eq.${id}&select=${ADMIN_AUDIT_COLUMNS}&limit=1`);
  if (!audit) throw new HttpError(404, 'That review was deleted or never existed.');
  const checks = await rows(`/rest/v1/seo_audit_checks?audit_id=eq.${id}&select=*&order=id.asc`);
  let tasks = await rows(`/rest/v1/seo_audit_tasks?audit_id=eq.${id}&select=*&order=priority_order.asc`);
  if (audit.overall_score == null && audit.status === 'complete') {
    await backfill(audit, checks, tasks.length > 0);
    if (!tasks.length) tasks = await rows(`/rest/v1/seo_audit_tasks?audit_id=eq.${id}&select=*&order=priority_order.asc`);
  }
  const checkKeys = Object.fromEntries(checks.map((c) => [c.id, c.check_key]));
  const [competitors, ranks] = await Promise.all([
    rows(`/rest/v1/seo_audit_competitors?audit_id=eq.${id}&select=*&order=position.asc.nullslast,id.asc`),
    rows(`/rest/v1/seo_audit_manual?audit_id=eq.${id}&select=keyword,rank_position,checked_on&order=id.desc&limit=10`),
  ]);
  return {
    audit,
    checks: checks.map(toCheck),
    tasks: tasks.map((t) => toTask(t, checkKeys)),
    competitors: competitors.map(toCompetitor),
    ranks,
    meta: meta(),
  };
}

function toCompetitor(row) {
  const s = row.scores || {};
  return {
    id: row.id,
    name: row.name,
    site: row.site_url,
    position: row.position,
    status: row.status,
    error: row.error,
    place: s.place ? { rating: s.place.rating, reviews: s.place.reviews, category: s.place.category, photos: s.place.photos, hours: (s.place.hours || []).length > 0, website: s.place.website } : null,
    statuses: s.statuses || {},
    overall: s.overall ?? null,
    manual: !row.place_id,
  };
}

// Reuse a PageSpeed result for the same address from the last 24 hours (it is slow and metered).
async function cachedPageSpeed(siteUrl) {
  const since = new Date(Date.now() - FETCH.pageSpeedCacheHours * 3600_000).toISOString();
  const recent = await rows(`/rest/v1/seo_audits?site_url=eq.${enc(siteUrl)}&status=eq.complete&created_at=gte.${enc(since)}&select=id&order=created_at.desc&limit=5`);
  if (!recent.length) return null;
  const ids = recent.map((r) => r.id).join(',');
  const found = await rows(`/rest/v1/seo_audit_checks?audit_id=in.(${ids})&check_key=eq.page_speed&status=neq.skipped&select=audit_id,details&limit=5`);
  const best = recent.map((r) => found.find((f) => f.audit_id === r.id)).find(Boolean);
  return best ? { mobile: best.details?.mobile || null, desktop: best.details?.desktop || null } : null;
}

// Google Places answers, by search and by place_id, for LOCAL.cacheHours.
const placesCache = {
  async get(key) {
    const since = new Date(Date.now() - LOCAL.cacheHours * 3600_000).toISOString();
    const [hit] = await rows(`/rest/v1/seo_places_cache?cache_key=eq.${enc(key)}&fetched_at=gte.${enc(since)}&select=data&limit=1`);
    return hit ? hit.data : null;
  },
  async set(key, data) {
    await sb('/rest/v1/seo_places_cache?on_conflict=cache_key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ cache_key: key, data, fetched_at: new Date().toISOString() }),
    });
  },
};

// What a competitor row keeps about its Google listing.
const storedPlace = (p) => ({ name: p.name, address: p.address, phone: p.phone, website: p.website, rating: p.rating, reviews: p.reviews, hours: p.hours, photos: p.photos, category: p.category, status: p.status, streetNumber: p.streetNumber, route: p.route, postalCode: p.postalCode });

const competitorRow = (auditId) => (c) => ({
  audit_id: auditId,
  name: c.name,
  site_url: c.website || null,
  place_id: c.placeId,
  position: c.position ?? null,
  status: 'pending',
  scores: { place: storedPlace(c), statuses: placeStatuses(c) },
});

const localNotes = (local) => ({
  configured: local.configured,
  query: local.query,
  placeId: local.place?.placeId || null,
  position: local.position,
  calls: local.calls,
  error: local.error,
  candidates: local.candidates.map((p) => ({ placeId: p.placeId, name: p.name, address: p.address, website: p.website, position: p.position })),
});

const upsertCheck = (auditId, check) =>
  sb('/rest/v1/seo_audit_checks?on_conflict=audit_id,check_key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(checkRow(auditId)(check)),
  });
const deleteCheck = (auditId, key) => sb(`/rest/v1/seo_audit_checks?audit_id=eq.${auditId}&check_key=eq.${key}`, { method: 'DELETE' });

// After a Phase 3 check changes: score again and rebuild Next Steps, keeping ticked tasks ticked.
async function rescore(auditId) {
  const checks = await rows(`/rest/v1/seo_audit_checks?audit_id=eq.${auditId}&select=id,category,check_key,status,score`);
  const scored = categoryScores(checks.map((r) => ({ key: r.check_key, category: r.category, status: r.status, score: r.score == null ? null : Number(r.score) })));
  await patch('seo_audits', `id=eq.${auditId}`, { overall_score: scored.overall, category_scores: scored.categories });
  const old = await rows(`/rest/v1/seo_audit_tasks?audit_id=eq.${auditId}&select=title,done`);
  const ticked = new Set(old.filter((t) => t.done).map((t) => t.title));
  await sb(`/rest/v1/seo_audit_tasks?audit_id=eq.${auditId}`, { method: 'DELETE' });
  const tasks = taskRows(auditId, checks).map((t) => ({ ...t, done: ticked.has(t.title) }));
  if (tasks.length) await insert('seo_audit_tasks', tasks);
}

async function loadAudit(id) {
  if (!UUID.test(id || '')) throw new HttpError(400, 'That review id is not valid.');
  const [audit] = await rows(`/rest/v1/seo_audits?id=eq.${id}&select=${AUDIT_COLUMNS}&limit=1`);
  if (!audit) throw new HttpError(404, 'That review was deleted or never existed.');
  if (audit.status !== 'complete') throw new HttpError(400, 'Wait for the review to finish first.');
  return audit;
}

const clean = (v, max = 120) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

async function run(body) {
  const business = clean(body.business);
  const city = clean(body.city, 80);
  const service = clean(body.service, 80);
  if (!business) throw new HttpError(400, 'Enter the business name.');
  if (!city) throw new HttpError(400, 'Enter the city the business serves.');
  if (!service) throw new HttpError(400, 'Enter the main service, like "pressure washing".');
  let url;
  try {
    url = normalizeUrl(body.url);
  } catch (e) {
    throw new HttpError(400, e.message);
  }
  const siteUrl = url.href;

  const [audit] = await insert('seo_audits', {
    site_url: siteUrl,
    business_name: business,
    city,
    service,
    status: 'running',
    share_token: randomBytes(18).toString('base64url'),
    lead_id: body.leadId ? clean(body.leadId, 64) : null,
  });

  // Google Places runs alongside the site checks. findLocal never throws.
  const localPromise = findLocal({ business, city, service, siteUrl }, { key: PLACES_KEY, cache: placesCache });

  try {
    const out = await runAudit(
      { url: siteUrl, business, city, service },
      {
        pageSpeedKey: PAGESPEED_KEY,
        cachedPageSpeed: body.fresh ? null : cachedPageSpeed,
        render: async (u, ms) => (await import('./_lib/seo-render.mjs')).renderHtml(u, ms),
      },
    );
    const local = await localPromise;
    out.checks.push(...localChecks(local, out.site.nap, { business, city, siteUrl: out.site.finalUrl }));
    const order = Object.keys(CHECKS);
    out.checks.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
    const saved = await insert('seo_audit_checks', out.checks.map(checkRow(audit.id)));
    if (local.competitors.length) {
      await insert('seo_audit_competitors', local.competitors.map(competitorRow(audit.id))).catch((e) => {
        console.error('seo competitors not saved:', e);
        out.notes.push('The competitors Google found could not be saved. Run supabase/seo.sql again in Supabase to add the Phase 3 columns.');
      });
    }
    const tasks = taskRows(audit.id, saved);
    if (tasks.length) await insert('seo_audit_tasks', tasks);
    const scored = categoryScores(out.checks);
    const done = {
      status: 'complete',
      final_url: out.site.finalUrl,
      overall_score: scored.overall,
      category_scores: scored.categories,
      duration_ms: out.durationMs,
      notes: { notes: out.notes, site: out.site, pageSpeedKey: !!PAGESPEED_KEY, local: localNotes(local) },
      error: out.site.error || null,
    };
    await patch('seo_audits', `id=eq.${audit.id}`, done);
    return getOne(audit.id);
  } catch (err) {
    const message = err instanceof AuditInputError ? err.message : 'The review stopped early. Try running it again.';
    await patch('seo_audits', `id=eq.${audit.id}`, { status: 'failed', error: message }).catch(() => {});
    if (err instanceof AuditInputError) throw new HttpError(400, message);
    throw err;
  }
}

async function setReviewed(body) {
  if (!UUID.test(body.id || '')) throw new HttpError(400, 'That review id is not valid.');
  const [audit] = await rows(`/rest/v1/seo_audits?id=eq.${body.id}&select=status&limit=1`);
  if (!audit) throw new HttpError(404, 'That review was deleted or never existed.');
  if (body.reviewed && audit.status !== 'complete') throw new HttpError(400, 'Only a finished review can be marked reviewed.');
  const reviewedAt = body.reviewed ? new Date().toISOString() : null;
  await patch('seo_audits', `id=eq.${body.id}`, { reviewed_at: reviewedAt });
  return { ok: true, reviewedAt };
}

async function setTask(body) {
  const id = Number(body.id);
  if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, 'That task id is not valid.');
  await patch('seo_audit_tasks', `id=eq.${id}`, { done: !!body.done });
  return { ok: true };
}

// ── Phase 3 actions ─────────────────────────────────────────────────────────

const clientInput = (audit) => ({ business: audit.business_name, city: audit.city, siteUrl: audit.final_url || audit.site_url });

// Runs the same checks on one competitor's site. Their Google listing grades were saved with the row.
async function runCompetitor(body) {
  const audit = await loadAudit(body.id);
  const cid = Number(body.competitorId);
  const [row] = Number.isSafeInteger(cid) ? await rows(`/rest/v1/seo_audit_competitors?id=eq.${cid}&audit_id=eq.${audit.id}&select=*&limit=1`) : [];
  if (!row) throw new HttpError(404, 'That competitor is not on this review.');
  const place = row.scores?.place || null;
  const statuses = { ...placeStatuses(place) };
  let error = null;
  if (row.site_url) {
    try {
      const out = await runAudit(
        { url: row.site_url, business: row.name, city: audit.city, service: audit.service },
        { pageSpeedKey: PAGESPEED_KEY, cachedPageSpeed, render: async (u, ms) => (await import('./_lib/seo-render.mjs')).renderHtml(u, ms) },
      );
      for (const c of out.checks) statuses[c.key] = c.status;
      if (place) {
        const [, , nap] = localChecks({ configured: true, place, competitors: [] }, out.site.nap, { business: row.name, city: audit.city, siteUrl: out.site.finalUrl });
        statuses.nap = nap.status;
      }
      if (out.site.error) error = `The home page could not be read: ${out.site.error}.`;
    } catch (e) {
      error = e instanceof AuditInputError ? e.message : 'The checks on this site stopped early.';
    }
  }
  // No site checks (no website, or it could not be read): a score from two Google checks alone
  // would not compare fairly with the client's, so leave it blank.
  const siteRan = Object.entries(statuses).some(([k, v]) => CHECKS[k]?.phase === 1 && v !== 'skipped');
  const overall = siteRan ? scoreAudit(Object.entries(statuses).filter(([k]) => CHECKS[k]).map(([key, status]) => ({ key, status }))).overall : null;
  const ran = Object.keys(statuses).length > 0;
  await patch('seo_audit_competitors', `id=eq.${row.id}`, {
    status: ran ? 'complete' : 'failed',
    error: ran ? error : error || 'Nothing about this competitor could be checked.',
    scores: { ...row.scores, statuses, overall, ranAt: new Date().toISOString() },
  });
  const [saved] = await rows(`/rest/v1/seo_audit_competitors?id=eq.${row.id}&select=*&limit=1`);
  return { competitor: toCompetitor(saved) };
}

// The competitors check, from every finished competitor. With none left, the check is removed.
async function compare(body) {
  const audit = await loadAudit(body.id);
  const [checks, comps] = await Promise.all([
    rows(`/rest/v1/seo_audit_checks?audit_id=eq.${audit.id}&select=check_key,status`),
    rows(`/rest/v1/seo_audit_competitors?audit_id=eq.${audit.id}&status=eq.complete&select=name,scores`),
  ]);
  const client = Object.fromEntries(checks.map((c) => [c.check_key, c.status]));
  if (comps.length) await upsertCheck(audit.id, competitorsCheck(client, comps.map((c) => ({ name: c.name, statuses: c.scores?.statuses || {} }))));
  else await deleteCheck(audit.id, 'competitors');
  await rescore(audit.id);
  return getOne(audit.id);
}

async function addCompetitor(body) {
  const audit = await loadAudit(body.id);
  const name = clean(body.name);
  let url;
  try {
    url = normalizeUrl(body.url);
  } catch (e) {
    throw new HttpError(400, e.message);
  }
  if (hostOf(url.href) === hostOf(audit.final_url || audit.site_url)) throw new HttpError(400, 'That is the business being reviewed.');
  const have = await rows(`/rest/v1/seo_audit_competitors?audit_id=eq.${audit.id}&select=id,site_url`);
  if (have.length >= LOCAL.competitors) throw new HttpError(400, `A review compares up to ${LOCAL.competitors} competitors. Remove one first.`);
  if (have.some((c) => c.site_url && hostOf(c.site_url) === hostOf(url.href))) throw new HttpError(400, 'That competitor is already on this review.');
  const [row] = await insert('seo_audit_competitors', { audit_id: audit.id, name: name || hostOf(url.href), site_url: url.href, status: 'pending', scores: {} });
  return { competitor: toCompetitor(row) };
}

async function removeCompetitor(body) {
  const audit = await loadAudit(body.id);
  const cid = Number(body.competitorId);
  if (!Number.isSafeInteger(cid)) throw new HttpError(400, 'That competitor id is not valid.');
  await sb(`/rest/v1/seo_audit_competitors?id=eq.${cid}&audit_id=eq.${audit.id}`, { method: 'DELETE' });
  return compare({ id: audit.id });
}

// The owner picks the right Google listing (or none) from the places the review already found.
// Costs no Places calls: the facts come from the cache.
async function pickPlace(body) {
  const audit = await loadAudit(body.id);
  const saved = audit.notes?.local;
  if (!saved?.configured) throw new HttpError(400, 'Google Places is not set up, so there is no listing to pick.');
  const candidates = await Promise.all((saved.candidates || []).map(async (c) => ({ ...((await placesCache.get(`place:${c.placeId}`).catch(() => null)) || c), position: c.position })));
  const place = body.placeId === 'none' ? null : candidates.find((c) => c.placeId === body.placeId);
  if (body.placeId !== 'none' && !Array.isArray(place?.hours)) throw new HttpError(400, 'That listing is no longer cached. Run the review again.');
  const host = hostOf(audit.final_url || audit.site_url);
  const competitors = candidates
    .filter((c) => c.position != null && c.placeId !== place?.placeId && !(host && hostOf(c.website || '') === host) && c.hours)
    .slice(0, LOCAL.competitors);
  const local = { configured: true, query: saved.query, place, position: place?.position ?? null, competitors, candidates: saved.candidates, calls: 0, error: null };

  for (const c of localChecks(local, audit.notes?.site?.nap || null, clientInput(audit))) await upsertCheck(audit.id, c);
  // Replace the competitors Google found; keep any added by hand.
  await sb(`/rest/v1/seo_audit_competitors?audit_id=eq.${audit.id}&place_id=not.is.null`, { method: 'DELETE' });
  const manual = await rows(`/rest/v1/seo_audit_competitors?audit_id=eq.${audit.id}&select=id`);
  const fresh = competitors.slice(0, Math.max(0, LOCAL.competitors - manual.length));
  if (fresh.length) await insert('seo_audit_competitors', fresh.map(competitorRow(audit.id)));
  await patch('seo_audits', `id=eq.${audit.id}`, { notes: { ...audit.notes, local: { ...saved, placeId: place?.placeId || null, position: local.position, picked: true } } });
  return compare({ id: audit.id });
}

async function setRank(body) {
  const audit = await loadAudit(body.id);
  const keyword = clean(body.keyword, 120) || `${audit.service} ${cityName(audit.city)}`.toLowerCase();
  const position = body.position == null || body.position === '' ? null : Number(body.position);
  if (position != null && !(Number.isInteger(position) && position >= 1 && position <= 100)) throw new HttpError(400, 'Enter a position from 1 to 100, or mark it as not in the top 10.');
  await insert('seo_audit_manual', { audit_id: audit.id, keyword, rank_position: position });
  await upsertCheck(audit.id, rankCheck(keyword, position));
  await rescore(audit.id);
  return getOne(audit.id);
}

// ── Client share ────────────────────────────────────────────────────────────

const SHARE_TOKEN = /^[A-Za-z0-9_-]{20,64}$/;
const speedScore = (run) => (typeof run?.score === 'number' ? run.score : null);

// Everything the client report needs, and nothing else. Exported for tests.
export function shareView(audit, checkRows, taskRows_, competitorRows = []) {
  const byKey = Object.fromEntries(checkRows.map((r) => [r.check_key, r]));
  const keyById = Object.fromEntries(checkRows.map((r) => [r.id, r.check_key]));
  const scored = scoreAudit(checkRows.map((r) => ({ key: r.check_key, category: r.category, status: r.status, score: r.score == null ? null : Number(r.score) })));
  const overall = audit.overall_score ?? scored.overall;
  const speed = checkRows.find((r) => r.check_key === 'page_speed' && r.status !== 'skipped')?.details;
  const recommended = OFFERS.find((o) => o.recommendFrom != null && overall != null && overall >= o.recommendFrom)?.key || null;
  let url = audit.final_url || audit.site_url;
  try { url = new URL(url).hostname.replace(/^www\./, ''); } catch { /* keep as saved */ }

  return {
    report: {
      business: audit.business_name,
      site: url,
      city: audit.city,
      service: audit.service,
      ranAt: audit.created_at,
      reviewedAt: audit.reviewed_at,
      overall,
      dropped: scored.dropped,
      categories: Object.fromEntries(
        Object.entries(CATEGORIES).map(([k, c]) => [k, { label: c.label, blurb: c.blurb, score: scored.categories[k].score, weight: scored.categories[k].weight }]),
      ),
      speed: speed ? { phone: speedScore(speed.mobile), computer: speedScore(speed.desktop) } : null,
    },
    checks: checkRows.map((r) => {
      const m = CHECKS[r.check_key] || {};
      return { key: r.check_key, label: m.label || r.check_key, category: r.category, status: r.status, summary: r.summary, explanation: r.explanation, service: SERVICES[m.service] };
    }),
    tasks: [...taskRows_]
      .sort((a, b) => a.priority_order - b.priority_order)
      .map((t) => {
        const c = byKey[keyById[t.check_id]];
        return { title: t.title, impact: t.impact, effort: t.effort, service: SERVICES[t.service_tag] || t.service_tag, status: c?.status || null, label: CHECKS[c?.check_key]?.label || null, why: c?.explanation || null };
      }),
    meta: {
      categories: Object.fromEntries(Object.entries(CATEGORIES).map(([k, c]) => [k, { label: c.label }])),
      checks: Object.fromEntries(Object.entries(CHECKS).map(([k, c]) => [k, { label: c.label, category: c.category, phase: c.phase }])),
    },
    local: shareLocal(byKey, competitorRows),
    offers: OFFERS.map(({ key, name, price, blurb }) => ({ key, name, price, blurb })),
    recommended,
    brand: BRAND,
  };
}

// The Google Business Profile, rank and competitor facts for the client page. Names, site
// hostnames, ratings and grades only: no place ids, map links or addresses.
function shareLocal(byKey, competitorRows) {
  const d = (k) => byKey[k]?.details || {};
  const gbp = byKey.gbp && byKey.gbp.status !== 'skipped' ? { status: byKey.gbp.status, found: d('gbp').found !== false, has: d('gbp').has || null, category: d('gbp').category || null, photos: d('gbp').photos ?? null } : null;
  const reviews = byKey.reviews && byKey.reviews.status !== 'skipped' ? { status: byKey.reviews.status, rating: d('reviews').rating ?? null, count: d('reviews').reviews ?? null, competitorAverage: d('reviews').competitorAverage ?? null } : null;
  const nap = byKey.nap && byKey.nap.status !== 'skipped' ? (d('nap').items || []).map((i) => ({ label: i.label, ok: !!i.ok })) : null;
  const rank = byKey.rank ? { keyword: d('rank').keyword || null, position: d('rank').position ?? null, status: byKey.rank.status } : null;
  const competitors = competitorRows
    .filter((c) => c.status === 'complete')
    .map((c) => ({
      name: c.name,
      site: c.site_url ? hostOf(c.site_url) : null,
      overall: c.scores?.overall ?? null,
      rating: c.scores?.place?.rating ?? null,
      reviews: c.scores?.place?.reviews ?? null,
      statuses: Object.fromEntries(Object.entries(c.scores?.statuses || {}).filter(([k]) => CHECKS[k])),
    }));
  return { gbp, reviews, nap, rank, competitors };
}

async function share(token) {
  const missing = new HttpError(404, 'This report is not available. Ask Christian for a new link.');
  if (!SHARE_TOKEN.test(token || '')) throw missing;
  const [audit] = await rows(`/rest/v1/seo_audits?share_token=eq.${enc(token)}&reviewed_at=not.is.null&status=eq.complete&select=${AUDIT_COLUMNS}&limit=1`);
  if (!audit) throw missing;
  const [checks, tasks, competitors] = await Promise.all([
    rows(`/rest/v1/seo_audit_checks?audit_id=eq.${audit.id}&select=*&order=id.asc`),
    rows(`/rest/v1/seo_audit_tasks?audit_id=eq.${audit.id}&select=*&order=priority_order.asc`),
    rows(`/rest/v1/seo_audit_competitors?audit_id=eq.${audit.id}&select=name,site_url,status,scores&order=position.asc.nullslast,id.asc`),
  ]);
  return shareView(audit, checks, tasks, competitors);
}

async function remove(body) {
  if (!UUID.test(body.id || '')) throw new HttpError(400, 'That review id is not valid.');
  await sb(`/rest/v1/seo_audits?id=eq.${body.id}`, { method: 'DELETE' });
  return { ok: true };
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    try {
      if (request.method === 'GET' && action === 'share') return json(await share(url.searchParams.get('t')));
      await requireAdmin(request);
      if (request.method === 'GET') {
        if (action === 'list') return json(await list());
        if (action === 'get') return json(await getOne(url.searchParams.get('id')));
        if (action === 'meta') return json(meta());
        throw new HttpError(400, 'Unknown action.');
      }
      if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
      const body = await request.json().catch(() => { throw new HttpError(400, 'Invalid JSON body.'); });
      if (action === 'run') return json(await run(body));
      if (action === 'review') return json(await setReviewed(body));
      if (action === 'task') return json(await setTask(body));
      if (action === 'delete') return json(await remove(body));
      if (action === 'competitor') return json(await runCompetitor(body));
      if (action === 'compare') return json(await compare(body));
      if (action === 'competitorAdd') return json(await addCompetitor(body));
      if (action === 'competitorRemove') return json(await removeCompetitor(body));
      if (action === 'place') return json(await pickPlace(body));
      if (action === 'rank') return json(await setRank(body));
      throw new HttpError(400, 'Unknown action.');
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      console.error('seo api failed:', err);
      return json({ error: 'Something went wrong on the server.' }, 500);
    }
  },
};
