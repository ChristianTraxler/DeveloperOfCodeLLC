// api/seo.mjs: backend for /admin/seo/ (SEO Review), one function with an ?action= switch.
//
// Public actions (no sign in, used by the client report at /seo/<share_token>):
//   GET  share&t=<token> one reviewed review, shaped for the client. Never ids, tokens, notes,
//                        raw check details or anything about other reviews.
//   POST request&t=<token> { tasks: [order], offer?, name, email?, phone?, message? } "Request
//                        implementation": saves the picks and emails Christian (Resend).
//   GET  cron            monthly re-scans for care plan leads (Vercel Cron, CRON_SECRET)
//
// Admin actions (need a Supabase session whose email is in ADMIN_EMAILS):
//   GET  list            every review, newest first, without the check details
//   GET  get&id=<uuid>   one review with all of its checks
//   GET  meta            check labels, categories and services from api/_lib/seo-config.mjs
//   POST run             { url, business, city, service, fresh? } runs the checks and saves them
//   POST review          { id, reviewed } sets or clears reviewed_at (only reviewed reviews will share)
//   POST task            { id, done } ticks a Next Steps task
//   POST delete          { id }
//   GET  fixreport&id=   the fix-it report: Markdown instructions for Claude (api/_lib/seo-fixreport.mjs)
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
// Phase 4, leads (api/_lib/seo-leads.mjs):
//   GET  leads           every lead with its latest score and review count
//   GET  lead&id=<uuid>  one lead, its reviews, score history, follow-up plan and requests
//   POST leadSave        { id?, fromAuditId?, business, site, city, service, contact, email, phone,
//                          source, status, carePlan, lastContact, nextFollowUp, notes }
//   POST followup        { id, day, done } ticks a day 0, 1, 3 or 7 follow-up
//   POST link            { auditId, leadId | null } puts a review on a lead (or takes it off)
//   POST leadDelete      { id } deletes the lead and keeps its reviews
//   run also takes { leadId } to file the new review under a lead.
//
// Scores and Next Steps (api/_lib/seo-score.mjs) are written on run. Reviews saved before
// Phase 2 get theirs the first time they are read.
//
// Env vars (server only):
//   SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAILS   same as api/marketing.mjs and api/demos.mjs
//   PAGESPEED_API_KEY                         Google PageSpeed Insights API key (free)
//   GOOGLE_PLACES_API_KEY                     Google Places API (New) key (free allowance, then paid)
//   RESEND_API_KEY, NOTIFY_FROM, NOTIFY_TO    same as api/notify.mjs, for implementation requests
//   CRON_SECRET                               Vercel sends it to the cron action as a Bearer token
//
// The checks themselves live in api/_lib/seo-checks.mjs and every threshold in seo-config.mjs.

import { randomBytes } from 'node:crypto';
import { AuditInputError, normalizeUrl, runAudit, PHASE_ONE } from './_lib/seo-checks.mjs';
import { CATEGORIES, CHECKS, SERVICES, FETCH, OFFERS, BRAND, LOCAL, LEAD_STATUSES, LEAD_SOURCES, FOLLOW_UPS, RESCAN, REQUESTS } from './_lib/seo-config.mjs';
import { buildFixReport, fixReportFilename } from './_lib/seo-fixreport.mjs';
import { LeadInputError, cleanLead, followUpPlan, plannedFollowUp, scoreHistory, dueForRescan, today } from './_lib/seo-leads.mjs';
import { scoreAudit, buildTasks } from './_lib/seo-score.mjs';
import { findLocal, localChecks, placeStatuses, rankCheck, competitorsCheck, hostOf } from './_lib/seo-local.mjs';
import { cityName } from './_lib/seo-html.mjs';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const PAGESPEED_KEY = process.env.PAGESPEED_API_KEY || '';
const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY || '';
const RESEND_KEY = process.env.RESEND_API_KEY || '';
const NOTIFY_FROM = process.env.NOTIFY_FROM || 'Developer Of Code, LLC <notify@developerofcode.com>';
const NOTIFY_TO = process.env.NOTIFY_TO || 'DeveloperOfCodeLLC@Gmail.com';
const CRON_SECRET = process.env.CRON_SECRET || '';
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
  leadStatuses: LEAD_STATUSES,
  leadSources: LEAD_SOURCES,
  followUps: FOLLOW_UPS,
  rescanDays: RESCAN.everyDays,
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
  const leads = await rows('/rest/v1/seo_leads?select=id,business_name&order=business_name.asc').catch(() => []);
  return { audits, leads: leads.map((l) => ({ id: l.id, business: l.business_name })), meta: meta() };
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

async function run(body, { rescan = false } = {}) {
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
  const leadId = body.leadId || null;
  if (leadId) await loadLead(leadId);

  const [audit] = await insert('seo_audits', {
    site_url: siteUrl,
    business_name: business,
    city,
    service,
    status: 'running',
    share_token: randomBytes(18).toString('base64url'),
    lead_id: leadId,
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
      notes: { notes: out.notes, site: out.site, pageSpeedKey: !!PAGESPEED_KEY, local: localNotes(local), ...(rescan ? { rescan: true } : {}) },
      error: out.site.error || null,
    };
    await patch('seo_audits', `id=eq.${audit.id}`, done);
    if (leadId) await afterLeadReview(leadId);
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


// ── Fix-it report ───────────────────────────────────────────────────────────

async function fixReport(id) {
  const view = await getOne(id);
  if (view.audit.status !== 'complete') throw new HttpError(400, 'Wait for the review to finish first.');
  return { markdown: buildFixReport(view), filename: fixReportFilename(view.audit) };
}

// ── Phase 4: leads ──────────────────────────────────────────────────────────

function toLead(row) {
  return {
    id: row.id,
    business: row.business_name,
    site: row.site_url,
    city: row.city,
    service: row.service,
    contact: row.contact_name,
    email: row.email,
    phone: row.phone,
    source: row.source,
    status: row.status,
    carePlan: row.care_plan,
    lastContact: row.last_contact,
    nextFollowUp: row.next_follow_up,
    reportSentOn: row.report_sent_on,
    followups: row.followups || {},
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadLead(id) {
  if (!UUID.test(id || '')) throw new HttpError(400, 'That lead id is not valid.');
  const [lead] = await rows(`/rest/v1/seo_leads?id=eq.${id}&select=*&limit=1`);
  if (!lead) throw new HttpError(404, 'That lead was deleted or never existed.');
  return lead;
}

const firstReviewAt = async (leadId) =>
  (await rows(`/rest/v1/seo_audits?lead_id=eq.${leadId}&status=eq.complete&select=created_at&order=created_at.asc&limit=1`))[0]?.created_at || null;

// A finished review moves a new lead to "Audit run" and starts the follow-ups.
async function afterLeadReview(leadId) {
  const lead = await loadLead(leadId);
  if (lead.status !== 'new') return;
  const next = { ...lead, status: 'audit_run' };
  await patch('seo_leads', `id=eq.${leadId}`, { status: 'audit_run', next_follow_up: lead.next_follow_up || plannedFollowUp(next, await firstReviewAt(leadId)), updated_at: new Date().toISOString() });
}

async function leads() {
  const [list, audits] = await Promise.all([
    rows('/rest/v1/seo_leads?select=*&order=next_follow_up.asc.nullslast,created_at.desc&limit=1000'),
    rows('/rest/v1/seo_audits?lead_id=not.is.null&select=id,lead_id,overall_score,status,created_at&order=created_at.desc&limit=5000'),
  ]);
  return {
    leads: list.map((l) => {
      const mine = audits.filter((a) => a.lead_id === l.id);
      const scored = mine.find((a) => a.status === 'complete' && a.overall_score != null);
      return { ...toLead(l), reviews: mine.length, latestScore: scored?.overall_score ?? null, latestAuditId: scored?.id || null, lastReviewAt: mine[0]?.created_at || null };
    }),
    meta: meta(),
  };
}

async function leadOne(id) {
  const lead = await loadLead(id);
  const [audits, requests] = await Promise.all([
    rows(`/rest/v1/seo_audits?lead_id=eq.${id}&select=${AUDIT_COLUMNS}&order=created_at.desc`),
    rows(`/rest/v1/seo_requests?lead_id=eq.${id}&select=id,audit_id,offer,tasks,name,email,phone,message,created_at&order=created_at.desc&limit=50`),
  ]);
  const first = [...audits].reverse().find((a) => a.status === 'complete')?.created_at || null;
  return {
    lead: toLead(lead),
    audits: audits.map((a) => ({ id: a.id, site: a.final_url || a.site_url, status: a.status, overall: a.overall_score, createdAt: a.created_at, reviewedAt: a.reviewed_at, monthly: !!a.notes?.rescan })),
    history: scoreHistory(audits),
    plan: followUpPlan(lead, first),
    requests: requests.map((r) => ({ ...r, offer: OFFERS.find((o) => o.key === r.offer)?.name || null })),
    meta: meta(),
  };
}

async function leadSave(body) {
  let fields;
  try {
    fields = cleanLead(body, { creating: !body.id });
  } catch (e) {
    if (e instanceof LeadInputError) throw new HttpError(400, e.message);
    throw e;
  }
  const now = new Date().toISOString();
  if (body.id) {
    const lead = await loadLead(body.id);
    if ((fields.status === 'won' || fields.status === 'lost') && !('nextFollowUp' in body)) fields.next_follow_up = null;
    await patch('seo_leads', `id=eq.${lead.id}`, { ...fields, updated_at: now });
    return leadOne(lead.id);
  }
  // A new lead, optionally made from a review: it takes the review's details and the review.
  let audit = null;
  if (body.fromAuditId) {
    if (!UUID.test(body.fromAuditId)) throw new HttpError(400, 'That review id is not valid.');
    [audit] = await rows(`/rest/v1/seo_audits?id=eq.${body.fromAuditId}&select=${AUDIT_COLUMNS}&limit=1`);
    if (!audit) throw new HttpError(404, 'That review was deleted or never existed.');
    fields = {
      ...fields,
      site_url: fields.site_url ?? audit.site_url,
      city: fields.city ?? audit.city,
      service: fields.service ?? audit.service,
      status: fields.status === 'new' && audit.status === 'complete' ? 'audit_run' : fields.status,
    };
  }
  const [lead] = await insert('seo_leads', { ...fields, created_at: now, updated_at: now });
  if (audit) {
    await patch('seo_audits', `id=eq.${audit.id}`, { lead_id: lead.id });
    if (!('next_follow_up' in fields)) await patch('seo_leads', `id=eq.${lead.id}`, { next_follow_up: plannedFollowUp(lead, await firstReviewAt(lead.id)) });
  }
  return leadOne(lead.id);
}

async function followUp(body) {
  const lead = await loadLead(body.id);
  const day = Number(body.day);
  if (!FOLLOW_UPS.some((f) => f.day === day)) throw new HttpError(400, 'That follow-up step does not exist.');
  const stamp = today();
  const followups = { ...(lead.followups || {}) };
  if (body.done) followups[day] = stamp;
  else delete followups[day];
  const update = { followups, updated_at: new Date().toISOString() };
  if (body.done) update.last_contact = stamp;
  if (body.done && day === 0) {
    update.report_sent_on = lead.report_sent_on || stamp;
    if (lead.status === 'new' || lead.status === 'audit_run') update.status = 'report_sent';
  }
  const next = { ...lead, ...update };
  update.next_follow_up = plannedFollowUp(next, await firstReviewAt(lead.id));
  await patch('seo_leads', `id=eq.${lead.id}`, update);
  return leadOne(lead.id);
}

async function linkAudit(body) {
  if (!UUID.test(body.auditId || '')) throw new HttpError(400, 'That review id is not valid.');
  if (body.leadId) await loadLead(body.leadId);
  await patch('seo_audits', `id=eq.${body.auditId}`, { lead_id: body.leadId || null });
  if (body.leadId) await afterLeadReview(body.leadId);
  return { ok: true };
}

async function leadDelete(body) {
  const lead = await loadLead(body.id);
  await patch('seo_audits', `lead_id=eq.${lead.id}`, { lead_id: null });
  await sb(`/rest/v1/seo_leads?id=eq.${lead.id}`, { method: 'DELETE' });
  return { ok: true };
}

// ── Email (Resend, same account as api/notify.mjs) ──────────────────────────

async function sendEmail({ subject, text, replyTo }) {
  if (!RESEND_KEY) return false;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: NOTIFY_FROM, to: NOTIFY_TO, subject, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
  }).catch((e) => ({ ok: false, statusText: e.message }));
  if (!res.ok) console.error('seo email not sent:', res.status, res.statusText);
  return !!res.ok;
}

// ── Phase 4: monthly re-scans (Vercel Cron) ─────────────────────────────────

async function cron(request) {
  if (!CRON_SECRET || request.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) throw new HttpError(401, 'Not allowed.');
  const care = await rows('/rest/v1/seo_leads?care_plan=eq.true&status=eq.won&select=*');
  if (!care.length) return { ran: [] };
  const audits = await rows(`/rest/v1/seo_audits?lead_id=in.(${care.map((l) => l.id).join(',')})&status=eq.complete&select=id,lead_id,overall_score,created_at,city,service`);
  const ran = [];
  for (const { lead, last } of dueForRescan(care, audits).slice(0, RESCAN.perRun)) {
    try {
      const out = await run({ url: lead.site_url, business: lead.business_name, city: lead.city || last.city, service: lead.service || last.service, leadId: lead.id, fresh: true }, { rescan: true });
      const score = out.audit.overall_score;
      ran.push({ lead: lead.business_name, before: last.overall_score, after: score });
      const origin = new URL(request.url).origin;
      await sendEmail({
        subject: `Monthly SEO re-scan: ${lead.business_name} ${last.overall_score ?? '?'} to ${score ?? '?'}`,
        text: `The monthly re-scan for ${lead.business_name} (${lead.site_url}) finished.\n\nScore: ${last.overall_score ?? 'none'} last time, ${score ?? 'none'} now.\n\nOpen it, check it and mark it reviewed before sending the report:\n${origin}/admin/seo/#/audit/${out.audit.id}\n`,
      });
    } catch (e) {
      console.error('seo rescan failed:', lead.id, e);
      ran.push({ lead: lead.business_name, error: e.message });
    }
  }
  return { ran };
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
        return { order: t.priority_order, title: t.title, impact: t.impact, effort: t.effort, service: SERVICES[t.service_tag] || t.service_tag, status: c?.status || null, label: CHECKS[c?.check_key]?.label || null, why: c?.explanation || null };
      }),
    meta: {
      categories: Object.fromEntries(Object.entries(CATEGORIES).map(([k, c]) => [k, { label: c.label }])),
      checks: Object.fromEntries(Object.entries(CHECKS).map(([k, c]) => [k, { label: c.label, category: c.category, phase: c.phase }])),
    },
    local: shareLocal(byKey, competitorRows),
    offers: OFFERS.map(({ key, name, price, blurb, payUrl }) => ({ key, name, price, blurb, payable: !!payUrl })),
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

async function sharedAudit(token) {
  const missing = new HttpError(404, 'This report is not available. Ask Christian for a new link.');
  if (!SHARE_TOKEN.test(token || '')) throw missing;
  const [audit] = await rows(`/rest/v1/seo_audits?share_token=eq.${enc(token)}&reviewed_at=not.is.null&status=eq.complete&select=${AUDIT_COLUMNS}&limit=1`);
  if (!audit) throw missing;
  return audit;
}

async function share(token) {
  const audit = await sharedAudit(token);
  const [checks, tasks, competitors] = await Promise.all([
    rows(`/rest/v1/seo_audit_checks?audit_id=eq.${audit.id}&select=*&order=id.asc`),
    rows(`/rest/v1/seo_audit_tasks?audit_id=eq.${audit.id}&select=*&order=priority_order.asc`),
    rows(`/rest/v1/seo_audit_competitors?audit_id=eq.${audit.id}&select=name,site_url,status,scores&order=position.asc.nullslast,id.asc`),
  ]);
  return shareView(audit, checks, tasks, competitors);
}

// "Request implementation": the client picks fixes (by their order in Next Steps) and an offer.
async function requestWork(token, body, request) {
  const audit = await sharedAudit(token);
  if (body.website) return { ok: true, payUrl: null }; // a hidden field only bots fill in
  const name = clean(body.name);
  const email = clean(body.email, 200).toLowerCase();
  const phone = clean(body.phone, 40);
  const message = String(body.message ?? '').trim().slice(0, 2000);
  if (!name) throw new HttpError(400, 'Add your name.');
  if (!email && !phone) throw new HttpError(400, 'Add an email or phone number so Christian can reach you.');
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, 'That email address does not look right.');
  const offer = OFFERS.find((o) => o.key === body.offer) || null;
  const picked = new Set((Array.isArray(body.tasks) ? body.tasks : []).map(Number));
  const tasks = (await rows(`/rest/v1/seo_audit_tasks?audit_id=eq.${audit.id}&select=title,priority_order&order=priority_order.asc`)).filter((t) => picked.has(t.priority_order));
  if (!tasks.length && !offer) throw new HttpError(400, 'Pick at least one fix or a package.');

  const since = new Date(Date.now() - 86_400_000).toISOString();
  const recent = await rows(`/rest/v1/seo_requests?audit_id=eq.${audit.id}&created_at=gte.${enc(since)}&select=id`);
  if (recent.length >= REQUESTS.perReportPerDay) throw new HttpError(429, 'This report already sent several requests today. Christian will be in touch, or call him directly.');

  const [saved] = await insert('seo_requests', { audit_id: audit.id, lead_id: audit.lead_id, offer: offer?.key || null, tasks: tasks.map((t) => t.title), name, email: email || null, phone: phone || null, message: message || null });
  const origin = new URL(request.url).origin;
  const emailed = await sendEmail({
    subject: `Implementation request: ${audit.business_name}`,
    replyTo: email || undefined,
    text: [
      `${name} asked for help with the SEO review of ${audit.business_name} (${audit.final_url || audit.site_url}).`,
      '',
      offer ? `Package: ${offer.name} (${offer.price})` : 'Package: none picked',
      '',
      tasks.length ? `Fixes picked:\n${tasks.map((t) => `- ${t.title}`).join('\n')}` : 'No single fixes picked.',
      '',
      `Email: ${email || 'not given'}`,
      `Phone: ${phone || 'not given'}`,
      message ? `\nMessage:\n${message}` : '',
      '',
      `Review: ${origin}/admin/seo/#/audit/${audit.id}`,
      audit.lead_id ? `Lead: ${origin}/admin/seo/#/leads/${audit.lead_id}` : '',
    ].join('\n'),
  });
  if (emailed) await patch('seo_requests', `id=eq.${saved.id}`, { emailed: true });
  if (audit.lead_id && UUID.test(audit.lead_id)) await patch('seo_leads', `id=eq.${audit.lead_id}`, { next_follow_up: today(), updated_at: new Date().toISOString() }).catch(() => {});
  return { ok: true, payUrl: offer?.payUrl || null };
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
      if (request.method === 'POST' && action === 'request') {
        const body = await request.json().catch(() => { throw new HttpError(400, 'Invalid JSON body.'); });
        return json(await requestWork(url.searchParams.get('t'), body, request));
      }
      if (request.method === 'GET' && action === 'cron') return json(await cron(request));
      await requireAdmin(request);
      if (request.method === 'GET') {
        if (action === 'list') return json(await list());
        if (action === 'get') return json(await getOne(url.searchParams.get('id')));
        if (action === 'meta') return json(meta());
        if (action === 'fixreport') return json(await fixReport(url.searchParams.get('id')));
        if (action === 'leads') return json(await leads());
        if (action === 'lead') return json(await leadOne(url.searchParams.get('id')));
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
      if (action === 'leadSave') return json(await leadSave(body));
      if (action === 'followup') return json(await followUp(body));
      if (action === 'link') return json(await linkAudit(body));
      if (action === 'leadDelete') return json(await leadDelete(body));
      throw new HttpError(400, 'Unknown action.');
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      console.error('seo api failed:', err);
      return json({ error: 'Something went wrong on the server.' }, 500);
    }
  },
};
