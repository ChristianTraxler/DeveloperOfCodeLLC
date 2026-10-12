// api/marketing.mjs: backend for /admin/marketing/, one function with an ?action= switch.
//
// Admin actions (need a Supabase session whose email is in ADMIN_EMAILS):
//   GET  load      settings, people, emails, plus real results for every sent email
//   POST save      { upsert: [{kind,id,data}], remove: [{kind,id}] }
//   POST test      one email to one address, nothing recorded
//   POST send      { campaignId, messages: [{contactId, subject, html}], scheduledAt? }
//   POST cancel    { campaignId } takes a scheduled email back to a draft
// Public actions:
//   GET/POST unsub   the unsubscribe link in every email (signed token, no login)
//   POST hook        Resend webhook: delivered, opened, clicked, bounced, complained
//   GET  cron        sends scheduled emails that are due (Vercel Cron, CRON_SECRET)
//
// Env vars (server only):
//   SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAILS     same as api/demos.mjs
//   RESEND_API_KEY                              sends the email
//   RESEND_WEBHOOK_SECRET                       "whsec_..." from the Resend webhook page
//   CRON_SECRET                                 Vercel sends it to the cron route as a Bearer token
//   MARKETING_BASE_URL                          optional, default https://developerofcode.com

import { createHmac, timingSafeEqual } from 'node:crypto';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const RESEND_KEY = process.env.RESEND_API_KEY || '';
const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET || '';
const CRON_SECRET = process.env.CRON_SECRET || '';
const BASE_URL = (process.env.MARKETING_BASE_URL || 'https://developerofcode.com').replace(/\/+$/, '');
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const UNSUBSCRIBE_TOKEN = '{{{RESEND_UNSUBSCRIBE_URL}}}';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KINDS = new Set(['settings', 'contact', 'campaign']);
const BATCH = 100;
const BATCH_GAP_MS = 600; // Resend allows 2 requests a second
const MAX_SEND = 2000;
const MAX_RESEND_SCHEDULED = 80; // one request each at 2 a second has to fit in the 60 second limit
const RESEND_SCHEDULE_DAYS = 29; // Resend schedules at most 30 days ahead

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const html = (title, body, status = 200) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head><body style="margin:0;background:#0a1020;color:#ece8df;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"><main style="max-width:480px;margin:0 auto;padding:72px 24px;"><h1 style="font-size:28px;margin:0 0 14px;">${title}</h1>${body}</main></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
  );

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toISOString();

// ── Supabase (plain fetch, no SDK) ──────────────────────────────────────────

async function requireAdmin(request) {
  const token = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') || '')?.[1];
  if (!token) throw new HttpError(401, 'Sign in first.');
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new HttpError(401, 'Your session expired. Sign in again.');
  const user = await res.json();
  if (!user?.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    throw new HttpError(403, 'This account is not allowed to use Marketing.');
  }
  return user;
}

async function sb(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, ...init.headers },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Supabase ${init.method || 'GET'} ${path.split('?')[0]} failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  return res;
}

// PostgREST returns at most 1000 rows a request, so read in pages.
async function selectAll(path) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const res = await sb(path, { headers: { Range: `${from}-${from + 999}`, 'Range-Unit': 'items' } });
    const page = await res.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

const enc = encodeURIComponent;
const upsertRows = (table, rows, onConflict) =>
  sb(`/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
const patchRows = (table, filter, body) =>
  sb(`/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
const deleteRows = (table, filter) => sb(`/rest/v1/${table}?${filter}`, { method: 'DELETE' });

async function getDoc(kind, id) {
  const rows = await (await sb(`/rest/v1/marketing_docs?kind=eq.${kind}&id=eq.${enc(id)}&select=data&limit=1`)).json();
  return rows[0]?.data || null;
}
const putDoc = (kind, id, data) => upsertRows('marketing_docs', [{ kind, id, data, updated_at: stamp() }], 'kind,id');

// ── Signed unsubscribe links ────────────────────────────────────────────────

const sign = (contactId) => createHmac('sha256', SERVICE_KEY).update(`unsub:${contactId}`).digest('hex').slice(0, 24);
const unsubUrl = (contactId) => `${BASE_URL}/api/marketing?action=unsub&t=${enc(`${contactId}.${sign(contactId)}`)}`;

function readToken(t) {
  const i = String(t || '').lastIndexOf('.');
  if (i < 1) return null;
  const id = t.slice(0, i);
  const mac = t.slice(i + 1);
  const want = sign(id);
  if (mac.length !== want.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(want))) return null;
  return id;
}

async function markUnsubscribed(contactId) {
  const c = await getDoc('contact', contactId);
  if (!c) return null;
  if (!c.unsubscribed) await putDoc('contact', contactId, { ...c, unsubscribed: true, unsubscribedAt: stamp() });
  return c;
}

// ── Resend ──────────────────────────────────────────────────────────────────

async function resend(path, body, idempotencyKey) {
  if (!RESEND_KEY) throw new HttpError(503, 'Email sending is not set up yet (RESEND_API_KEY is missing).');
  const res = await fetch(`https://api.resend.com${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* not JSON */ }
  if (!res.ok) throw new Error(data?.message || `Resend ${res.status}: ${text.slice(0, 200)}`);
  return data;
}

const tag = (s) => String(s).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 256);
const fromLine = (s) => `${String(s.fromName || '').replace(/["<>\r\n]/g, '').trim() || 'Developer of Code'} <${s.fromEmail}>`;

function checkSettings(s) {
  if (!s) throw new HttpError(400, 'Save your sender settings first.');
  if (!EMAIL_RE.test(s.fromEmail || '')) throw new HttpError(400, 'Add a sending address in Settings.');
  if (!String(s.mailingAddress || '').trim()) throw new HttpError(400, 'Add your mailing address in Settings. Every marketing email must include one.');
}

// Sends queued rows in batches of 100, marks each row, returns { sent, failed }.
async function dispatchRows(rows, settings, campaignId) {
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    if (i) await sleep(BATCH_GAP_MS);
    const payload = chunk.map((r) => {
      const url = unsubUrl(r.contact_id);
      return {
        from: fromLine(settings),
        to: [r.email],
        subject: r.subject,
        html: String(r.html || '').split(UNSUBSCRIBE_TOKEN).join(url),
        ...(settings.replyTo ? { reply_to: settings.replyTo } : {}),
        headers: { 'List-Unsubscribe': `<${url}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
        tags: [{ name: 'campaign', value: tag(r.campaign_id) }, { name: 'contact', value: tag(r.contact_id) }],
      };
    });
    try {
      const out = await resend('/emails/batch', payload, `mk-${campaignId}-${chunk.map((r) => r.id).join('-')}`.slice(0, 256));
      const ids = out?.data || [];
      for (let j = 0; j < chunk.length; j++) {
        const id = ids[j]?.id;
        await patchRows('marketing_sends', `id=eq.${chunk[j].id}`, id ? { status: 'sent', sent_at: stamp(), resend_id: id, html: null, error: null } : { status: 'failed', error: 'Resend did not return an id.' });
        if (id) sent++; else failed++;
      }
    } catch (err) {
      for (const r of chunk) await patchRows('marketing_sends', `id=eq.${r.id}`, { status: 'failed', error: String(err.message || err).slice(0, 300) });
      failed += chunk.length;
    }
  }
  return { sent, failed };
}

// When nothing is left queued, the email counts as sent.
async function settleCampaign(campaignId) {
  const left = await (await sb(`/rest/v1/marketing_sends?campaign_id=eq.${enc(campaignId)}&status=eq.queued&select=id&limit=1`)).json();
  if (left.length) return;
  const c = await getDoc('campaign', campaignId);
  if (!c || c.status === 'sent') return;
  const first = await (await sb(`/rest/v1/marketing_sends?campaign_id=eq.${enc(campaignId)}&status=eq.sent&select=sent_at&order=sent_at.asc&limit=1`)).json();
  await putDoc('campaign', campaignId, { ...c, status: 'sent', sentAt: first[0]?.sent_at || stamp(), scheduledFor: null, updatedAt: stamp() });
}

// Hands each queued row to Resend with a send time, so Resend sends it later without any cron.
async function scheduleAtResend(rows, settings, when) {
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (i) await sleep(BATCH_GAP_MS);
    const url = unsubUrl(r.contact_id);
    try {
      const out = await resend('/emails', {
        from: fromLine(settings),
        to: [r.email],
        subject: r.subject,
        html: String(r.html || '').split(UNSUBSCRIBE_TOKEN).join(url),
        ...(settings.replyTo ? { reply_to: settings.replyTo } : {}),
        headers: { 'List-Unsubscribe': `<${url}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
        tags: [{ name: 'campaign', value: tag(r.campaign_id) }, { name: 'contact', value: tag(r.contact_id) }],
        scheduled_at: when.toISOString(),
      }, `mk-${r.campaign_id}-${r.id}-${when.getTime()}`.slice(0, 256));
      if (!out?.id) throw new Error('Resend did not return an id.');
      await patchRows('marketing_sends', `id=eq.${r.id}`, { status: 'sent', sent_at: when.toISOString(), resend_id: out.id, html: null, error: null });
      sent++;
    } catch (err) {
      await patchRows('marketing_sends', `id=eq.${r.id}`, { status: 'failed', error: String(err.message || err).slice(0, 300) });
      failed++;
    }
  }
  return { sent, failed };
}

// Takes back emails Resend is holding for a future time, and forgets them here.
async function cancelResendScheduled(campaignId) {
  const held = await selectAll(`/rest/v1/marketing_sends?campaign_id=eq.${enc(campaignId)}&status=eq.sent&send_at=gt.${enc(stamp())}&select=id,resend_id`);
  for (let i = 0; i < held.length; i++) {
    if (i) await sleep(BATCH_GAP_MS);
    if (held[i].resend_id) await resend(`/emails/${held[i].resend_id}/cancel`, {}).catch(() => {}); // already gone is fine
  }
  if (held.length) await deleteRows('marketing_sends', `campaign_id=eq.${enc(campaignId)}&status=eq.sent&send_at=gt.${enc(stamp())}`);
}

// ── Admin actions ───────────────────────────────────────────────────────────

async function load() {
  const [docs, sends, events] = await Promise.all([
    selectAll('/rest/v1/marketing_docs?select=kind,id,data'),
    selectAll('/rest/v1/marketing_sends?select=campaign_id,contact_id,status,resend_id,error'),
    selectAll('/rest/v1/marketing_events?select=campaign_id,contact_id,type,link,at&order=at.asc'),
  ]);
  const settings = docs.find((d) => d.kind === 'settings')?.data || null;
  const contacts = docs.filter((d) => d.kind === 'contact').map((d) => d.data);
  const campaigns = docs.filter((d) => d.kind === 'campaign').map((d) => d.data);

  // An email Resend was holding for later counts as sent once its time has passed
  for (const c of campaigns) {
    if (c.status !== 'scheduled' || !c.scheduledFor || new Date(c.scheduledFor) > new Date()) continue;
    if (sends.some((x) => x.campaign_id === c.id && x.status === 'queued')) continue; // the cron still has to send it
    c.status = 'sent';
    c.sentAt = c.scheduledFor;
    c.scheduledFor = null;
    await putDoc('campaign', c.id, c);
  }
  const contactById = new Map(contacts.map((c) => [c.id, c]));

  for (const c of campaigns) {
    if (c.status !== 'sent') continue;
    const mine = sends.filter((s) => s.campaign_id === c.id && s.status === 'sent');
    const failed = sends.filter((s) => s.campaign_id === c.id && s.status === 'failed').length;
    const ev = events.filter((e) => e.campaign_id === c.id);
    const bounced = new Set(ev.filter((e) => e.type === 'bounced').map((e) => e.contact_id)).size;
    const t0 = new Date(c.sentAt).getTime();
    const people = new Map();
    for (const e of ev) {
      if (e.type !== 'opened' && e.type !== 'clicked') continue;
      const minutes = Math.max(0, Math.round((new Date(e.at).getTime() - t0) / 60000));
      const p = people.get(e.contact_id) || { id: e.contact_id, at: minutes, clicks: [], unsub: false };
      p.at = Math.min(p.at, minutes);
      if (e.type === 'clicked' && e.link) p.clicks.push(e.link);
      people.set(e.contact_id, p);
    }
    const unsubscribed = mine.filter((s) => {
      const u = contactById.get(s.contact_id);
      return u?.unsubscribed && u.unsubscribedAt && new Date(u.unsubscribedAt) >= new Date(c.sentAt);
    }).length;
    c.stats = {
      recipients: mine.length + failed,
      failed,
      bounced,
      delivered: Math.max(0, mine.length - bounced),
      unsubscribed,
      people: [...people.values()].sort((a, b) => a.at - b.at),
    };
  }
  return { settings, contacts, campaigns };
}

async function save(body) {
  const upsert = Array.isArray(body.upsert) ? body.upsert : [];
  const remove = Array.isArray(body.remove) ? body.remove : [];
  const rows = [];
  for (const item of upsert) {
    if (!KINDS.has(item?.kind) || typeof item.id !== 'string' || !item.id || typeof item.data !== 'object' || !item.data) throw new HttpError(400, 'Bad item in save.');
    let data = item.data;
    if (item.kind === 'campaign') {
      // Sending and results belong to the server: a stale browser must not undo them.
      const { stats, ...rest } = data; // eslint-disable-line no-unused-vars
      const existing = await getDoc('campaign', item.id);
      data = existing && existing.status !== 'draft'
        ? { ...rest, status: existing.status, sentAt: existing.sentAt ?? null, scheduledFor: existing.scheduledFor ?? null }
        : { ...rest, status: 'draft', sentAt: null, scheduledFor: null };
    } else if (item.kind === 'contact') {
      // Someone who unsubscribed stays unsubscribed.
      const existing = await getDoc('contact', item.id);
      if (existing?.unsubscribed) data = { ...data, unsubscribed: true, unsubscribedAt: existing.unsubscribedAt };
    }
    rows.push({ kind: item.kind, id: item.id, data, updated_at: stamp() });
  }
  if (rows.length) await upsertRows('marketing_docs', rows, 'kind,id');
  for (const item of remove) {
    if (!KINDS.has(item?.kind) || typeof item.id !== 'string') continue;
    await deleteRows('marketing_docs', `kind=eq.${item.kind}&id=eq.${enc(item.id)}`);
    if (item.kind === 'campaign') await deleteRows('marketing_sends', `campaign_id=eq.${enc(item.id)}&status=eq.queued`);
  }
  return { ok: true };
}

async function test(body) {
  const settings = await getDoc('settings', 'main');
  if (!settings || !EMAIL_RE.test(settings.fromEmail || '')) throw new HttpError(400, 'Add a sending address in Settings.');
  const to = String(body.to || '').trim();
  if (!EMAIL_RE.test(to)) throw new HttpError(400, 'Enter a valid email address.');
  const url = `${BASE_URL}/api/marketing?action=unsub&t=test`;
  await resend('/emails', {
    from: fromLine(settings),
    to: [to],
    subject: `[Test] ${String(body.subject || 'Untitled email').slice(0, 200)}`,
    html: String(body.html || '').split(UNSUBSCRIBE_TOKEN).join(url),
    ...(settings.replyTo ? { reply_to: settings.replyTo } : {}),
  });
  return { ok: true };
}

async function send(body) {
  const { campaignId } = body;
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (typeof campaignId !== 'string' || !campaignId) throw new HttpError(400, 'Missing email id.');
  if (!messages.length) throw new HttpError(400, 'No one to send to.');
  if (messages.length > MAX_SEND) throw new HttpError(400, `Send to ${MAX_SEND} people or fewer at a time.`);

  const campaign = await getDoc('campaign', campaignId);
  if (!campaign) throw new HttpError(404, 'Save the email first, then send.');
  if (campaign.status === 'sent') throw new HttpError(409, 'This email was already sent.');
  const settings = await getDoc('settings', 'main');
  checkSettings(settings);

  const when = body.scheduledAt ? new Date(body.scheduledAt) : null;
  if (when && (Number.isNaN(when.getTime()) || when.getTime() < Date.now() - 60000)) throw new HttpError(400, 'Pick a time in the future.');
  const later = when && when.getTime() > Date.now() + 60000;

  // Only people who said yes and have not unsubscribed, checked here and not just in the browser.
  const rows = [];
  const seen = new Set();
  for (const m of messages) {
    const c = typeof m?.contactId === 'string' ? await getDoc('contact', m.contactId) : null;
    if (!c || seen.has(c.id) || !EMAIL_RE.test(c.email || '') || !c.optedIn || c.unsubscribed) continue;
    if (typeof m.html !== 'string' || !m.html.includes(UNSUBSCRIBE_TOKEN)) throw new HttpError(400, 'An email is missing its unsubscribe link.');
    seen.add(c.id);
    rows.push({
      campaign_id: campaignId,
      contact_id: c.id,
      email: c.email.trim(),
      subject: String(m.subject || campaign.subject || '').slice(0, 300),
      html: m.html,
      status: 'queued',
      send_at: (later ? when : new Date()).toISOString(),
      resend_id: null,
      error: null,
      sent_at: null,
    });
  }
  if (!rows.length) throw new HttpError(400, 'No one on this list can get email right now.');

  // Replace whatever was queued or held at Resend before (a changed scheduled email), but never resend to someone already sent.
  if (campaign.status === 'scheduled') await cancelResendScheduled(campaignId);
  await deleteRows('marketing_sends', `campaign_id=eq.${enc(campaignId)}&status=in.(queued,failed)`);
  const done = new Set((await (await sb(`/rest/v1/marketing_sends?campaign_id=eq.${enc(campaignId)}&status=eq.sent&select=contact_id`)).json()).map((r) => r.contact_id));
  const fresh = rows.filter((r) => !done.has(r.contact_id));
  if (!fresh.length) throw new HttpError(409, 'Everyone on this list already got this email.');
  await upsertRows('marketing_sends', fresh, 'campaign_id,contact_id');

  if (later) {
    // Small lists go to Resend now with a send time. Big or far-off ones wait for the daily cron.
    const atResend = fresh.length <= MAX_RESEND_SCHEDULED && when.getTime() < Date.now() + RESEND_SCHEDULE_DAYS * 86400000;
    if (atResend) {
      const queuedRows = await selectAll(`/rest/v1/marketing_sends?campaign_id=eq.${enc(campaignId)}&status=eq.queued&select=id,campaign_id,contact_id,email,subject,html&order=id.asc`);
      const out = await scheduleAtResend(queuedRows, settings, when);
      if (!out.sent) {
        const err = (await (await sb(`/rest/v1/marketing_sends?campaign_id=eq.${enc(campaignId)}&status=eq.failed&select=error&limit=1`)).json())[0]?.error;
        throw new HttpError(502, `Nothing was scheduled. Resend said: ${err || 'unknown error'}`);
      }
    }
    const next = { ...campaign, status: 'scheduled', scheduledFor: when.toISOString(), sentAt: null, updatedAt: stamp() };
    await putDoc('campaign', campaignId, next);
    return { ok: true, scheduled: true, exact: atResend, count: fresh.length, campaign: next };
  }

  const queued = await selectAll(`/rest/v1/marketing_sends?campaign_id=eq.${enc(campaignId)}&status=eq.queued&select=id,campaign_id,contact_id,email,subject,html&order=id.asc`);
  const result = await dispatchRows(queued, settings, campaignId);
  if (!result.sent) {
    throw new HttpError(502, `Nothing was sent. Resend said: ${(await (await sb(`/rest/v1/marketing_sends?campaign_id=eq.${enc(campaignId)}&status=eq.failed&select=error&limit=1`)).json())[0]?.error || 'unknown error'}`);
  }
  await settleCampaign(campaignId);
  return { ok: true, ...result, count: fresh.length, campaign: await getDoc('campaign', campaignId) };
}

async function cancel(body) {
  const { campaignId } = body;
  if (typeof campaignId !== 'string' || !campaignId) throw new HttpError(400, 'Missing email id.');
  const c = await getDoc('campaign', campaignId);
  if (!c) throw new HttpError(404, 'Email not found.');
  if (c.status === 'sent') throw new HttpError(409, 'This email already went out.');
  await cancelResendScheduled(campaignId);
  await deleteRows('marketing_sends', `campaign_id=eq.${enc(campaignId)}&status=in.(queued,failed)`);
  const next = { ...c, status: 'draft', scheduledFor: null, updatedAt: stamp() };
  await putDoc('campaign', campaignId, next);
  return { ok: true, campaign: next };
}

// ── Public actions ──────────────────────────────────────────────────────────

async function unsubscribe(request, url) {
  const id = readToken(url.searchParams.get('t'));
  if (!id) return html('This link is not valid', '<p style="color:#a9a79f;line-height:1.6;">The unsubscribe link looks incomplete. Reply to the email and ask to be removed, and it will be done.</p>', 400);
  // Mail apps send a POST for one-click unsubscribe; people open the link with a GET.
  if (request.method === 'POST') {
    await markUnsubscribed(id);
    return new Response('ok');
  }
  if (url.searchParams.get('confirm') === '1') {
    await markUnsubscribed(id);
    return html('You are unsubscribed', '<p style="color:#a9a79f;line-height:1.6;">You will not get any more emails from Developer of Code. Sorry to see you go.</p>');
  }
  return html(
    'Unsubscribe?',
    `<p style="color:#a9a79f;line-height:1.6;">Press the button to stop getting emails from Developer of Code.</p><form method="get" action="/api/marketing"><input type="hidden" name="action" value="unsub"><input type="hidden" name="t" value="${url.searchParams.get('t').replace(/[^\w.%-]/g, '')}"><input type="hidden" name="confirm" value="1"><button style="margin-top:18px;height:46px;padding:0 24px;border:0;border-radius:999px;background:#ff5a1f;color:#1c0a02;font-size:16px;font-weight:600;cursor:pointer;">Unsubscribe me</button></form>`,
  );
}

function verifyWebhook(request, raw) {
  if (!WEBHOOK_SECRET) throw new HttpError(503, 'Webhook secret is not set.');
  const id = request.headers.get('svix-id') || '';
  const ts = request.headers.get('svix-timestamp') || '';
  const sigs = (request.headers.get('svix-signature') || '').split(' ').map((p) => p.split(',')[1]).filter(Boolean);
  if (!id || !ts || !sigs.length || Math.abs(Date.now() / 1000 - Number(ts)) > 300) throw new HttpError(400, 'Bad webhook.');
  const key = Buffer.from(WEBHOOK_SECRET.replace(/^whsec_/, ''), 'base64');
  const want = createHmac('sha256', key).update(`${id}.${ts}.${raw}`).digest('base64');
  const ok = sigs.some((s) => s.length === want.length && timingSafeEqual(Buffer.from(s), Buffer.from(want)));
  if (!ok) throw new HttpError(400, 'Bad webhook signature.');
}

const EVENT_TYPES = { 'email.delivered': 'delivered', 'email.opened': 'opened', 'email.clicked': 'clicked', 'email.bounced': 'bounced', 'email.complained': 'complained' };

async function webhook(request) {
  const raw = await request.text();
  verifyWebhook(request, raw);
  const evt = JSON.parse(raw);
  const type = EVENT_TYPES[evt?.type];
  const emailId = evt?.data?.email_id;
  if (!type || !emailId) return json({ ok: true, ignored: true });
  const row = (await (await sb(`/rest/v1/marketing_sends?resend_id=eq.${enc(emailId)}&select=campaign_id,contact_id&limit=1`)).json())[0];
  if (!row) return json({ ok: true, ignored: true }); // not one of ours (for example the waitlist emails)
  await upsertRows('marketing_events', [{
    resend_id: emailId,
    campaign_id: row.campaign_id,
    contact_id: row.contact_id,
    type,
    link: type === 'clicked' ? String(evt.data?.click?.link || '').slice(0, 1000) : null,
    at: evt.data?.click?.timestamp || evt.created_at || stamp(),
  }], 'id');
  if (type === 'complained') await markUnsubscribed(row.contact_id);
  return json({ ok: true });
}

async function cron(request) {
  const auth = request.headers.get('authorization') || '';
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) throw new HttpError(401, 'Not allowed.');
  const settings = await getDoc('settings', 'main');
  const due = await selectAll(`/rest/v1/marketing_sends?status=eq.queued&send_at=lte.${enc(stamp())}&select=id,campaign_id,contact_id,email,subject,html&order=id.asc&limit=1000`);
  if (!due.length) return json({ ok: true, due: 0 });
  checkSettings(settings);
  const byCampaign = new Map();
  for (const r of due) byCampaign.set(r.campaign_id, [...(byCampaign.get(r.campaign_id) || []), r]);
  const out = {};
  for (const [campaignId, rows] of byCampaign) {
    // Skip people who unsubscribed after the email was scheduled.
    const ok = [];
    for (const r of rows) {
      const c = await getDoc('contact', r.contact_id);
      if (c && !c.unsubscribed && c.optedIn) ok.push(r);
      else await patchRows('marketing_sends', `id=eq.${r.id}`, { status: 'failed', error: 'Unsubscribed before send', html: null });
    }
    out[campaignId] = await dispatchRows(ok, settings, campaignId);
    await settleCampaign(campaignId);
  }
  return json({ ok: true, due: due.length, campaigns: out });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    try {
      if (action === 'unsub') return await unsubscribe(request, url);
      if (action === 'hook' && request.method === 'POST') return await webhook(request);
      if (action === 'cron' && request.method === 'GET') return await cron(request);

      await requireAdmin(request);
      if (request.method === 'GET') {
        if (action === 'load') return json(await load());
        throw new HttpError(400, 'Unknown action.');
      }
      if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed.');
      const body = await request.json().catch(() => { throw new HttpError(400, 'Invalid JSON body.'); });
      if (action === 'save') return json(await save(body));
      if (action === 'test') return json(await test(body));
      if (action === 'send') return json(await send(body));
      if (action === 'cancel') return json(await cancel(body));
      throw new HttpError(400, 'Unknown action.');
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      console.error('marketing api failed:', err);
      return json({ error: 'Something went wrong on the server.' }, 500);
    }
  },
};
