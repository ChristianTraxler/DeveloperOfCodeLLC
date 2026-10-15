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
// Scores and Next Steps (api/_lib/seo-score.mjs) are written on run. Reviews saved before
// Phase 2 get theirs the first time they are read.
//
// Env vars (server only):
//   SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAILS   same as api/marketing.mjs and api/demos.mjs
//   PAGESPEED_API_KEY                         Google PageSpeed Insights API key (free)
//
// The checks themselves live in api/_lib/seo-checks.mjs and every threshold in seo-config.mjs.

import { randomBytes } from 'node:crypto';
import { AuditInputError, normalizeUrl, runAudit, PHASE_ONE } from './_lib/seo-checks.mjs';
import { CATEGORIES, CHECKS, SERVICES, FETCH, OFFERS, BRAND } from './_lib/seo-config.mjs';
import { scoreAudit, buildTasks } from './_lib/seo-score.mjs';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const PAGESPEED_KEY = process.env.PAGESPEED_API_KEY || '';
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
  for (const c of checks) out[c.category][c.status]++;
  for (const m of Object.values(CHECKS)) if (m.phase > 1) out[m.category].notRun++;
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
  return { audit, checks: checks.map(toCheck), tasks: tasks.map((t) => toTask(t, checkKeys)), meta: meta() };
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

  try {
    const out = await runAudit(
      { url: siteUrl, business, city, service },
      {
        pageSpeedKey: PAGESPEED_KEY,
        cachedPageSpeed: body.fresh ? null : cachedPageSpeed,
        render: async (u, ms) => (await import('./_lib/seo-render.mjs')).renderHtml(u, ms),
      },
    );
    const saved = await insert('seo_audit_checks', out.checks.map(checkRow(audit.id)));
    const tasks = taskRows(audit.id, saved);
    if (tasks.length) await insert('seo_audit_tasks', tasks);
    const scored = categoryScores(out.checks);
    const done = {
      status: 'complete',
      final_url: out.site.finalUrl,
      overall_score: scored.overall,
      category_scores: scored.categories,
      duration_ms: out.durationMs,
      notes: { notes: out.notes, site: out.site, pageSpeedKey: !!PAGESPEED_KEY },
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

// ── Client share ────────────────────────────────────────────────────────────

const SHARE_TOKEN = /^[A-Za-z0-9_-]{20,64}$/;
const speedScore = (run) => (typeof run?.score === 'number' ? run.score : null);

// Everything the client report needs, and nothing else. Exported for tests.
export function shareView(audit, checkRows, taskRows_) {
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
    offers: OFFERS.map(({ key, name, price, blurb }) => ({ key, name, price, blurb })),
    recommended,
    brand: BRAND,
  };
}

async function share(token) {
  const missing = new HttpError(404, 'This report is not available. Ask Christian for a new link.');
  if (!SHARE_TOKEN.test(token || '')) throw missing;
  const [audit] = await rows(`/rest/v1/seo_audits?share_token=eq.${enc(token)}&reviewed_at=not.is.null&status=eq.complete&select=${AUDIT_COLUMNS}&limit=1`);
  if (!audit) throw missing;
  const [checks, tasks] = await Promise.all([
    rows(`/rest/v1/seo_audit_checks?audit_id=eq.${audit.id}&select=*&order=id.asc`),
    rows(`/rest/v1/seo_audit_tasks?audit_id=eq.${audit.id}&select=*&order=priority_order.asc`),
  ]);
  return shareView(audit, checks, tasks);
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
      throw new HttpError(400, 'Unknown action.');
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      console.error('seo api failed:', err);
      return json({ error: 'Something went wrong on the server.' }, 500);
    }
  },
};
