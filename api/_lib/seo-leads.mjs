// api/_lib/seo-leads.mjs: Phase 4 lead logic with no I/O, so it can be tested on its own.
//
//   cleanLead(body)                   checks and trims the fields the owner can edit
//   followUpPlan(lead, firstAuditAt)  the day 0, 1, 3 and 7 steps, with due dates and the next one
//   scoreHistory(audits)              finished reviews, oldest first, with the change from the last
//   dueForRescan(leads, audits, now)  care plan leads whose newest review is a month old

import { LEAD_STATUSES, LEAD_SOURCES, FOLLOW_UPS, RESCAN } from './seo-config.mjs';

export class LeadInputError extends Error {}

const DAY = 86_400_000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const today = (now = new Date()) => now.toISOString().slice(0, 10);
export const addDays = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);

const text = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const date = (v, label) => {
  if (v == null || v === '') return null;
  if (!DATE.test(v) || Number.isNaN(Date.parse(v))) throw new LeadInputError(`${label} is not a valid date.`);
  return v;
};

// Only the keys present in body are returned, so a save can change one field without the others.
export function cleanLead(body, { creating = false } = {}) {
  const out = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);
  if (creating || has('business')) {
    out.business_name = text(body.business, 120);
    if (!out.business_name) throw new LeadInputError('Enter the business name.');
  }
  if (has('site')) out.site_url = text(body.site, 300) || null;
  if (has('city')) out.city = text(body.city, 80) || null;
  if (has('service')) out.service = text(body.service, 80) || null;
  if (has('contact')) out.contact_name = text(body.contact, 120) || null;
  if (has('email')) {
    out.email = text(body.email, 200).toLowerCase() || null;
    if (out.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(out.email)) throw new LeadInputError('That email address does not look right.');
  }
  if (has('phone')) out.phone = text(body.phone, 40) || null;
  if (has('source')) {
    out.source = body.source || null;
    if (out.source && !LEAD_SOURCES[out.source]) throw new LeadInputError('Pick a source from the list.');
  }
  if (creating || has('status')) {
    out.status = body.status || 'new';
    if (!LEAD_STATUSES[out.status]) throw new LeadInputError('Pick a status from the list.');
  }
  if (has('carePlan')) out.care_plan = !!body.carePlan;
  if (has('lastContact')) out.last_contact = date(body.lastContact, 'Last contact');
  if (has('nextFollowUp')) out.next_follow_up = date(body.nextFollowUp, 'Next follow-up');
  if (has('notes')) out.notes = String(body.notes ?? '').slice(0, 5000);
  return out;
}

// Follow-ups count from report_sent_on, or from the first review until the report goes out.
// followups is { "<day>": "YYYY-MM-DD" } for the steps already done.
export function followUpPlan(lead, firstAuditAt) {
  const anchor = lead.report_sent_on || (firstAuditAt ? String(firstAuditAt).slice(0, 10) : null);
  const done = lead.followups || {};
  const closed = lead.status === 'won' || lead.status === 'lost';
  const steps = FOLLOW_UPS.map((s) => ({ ...s, due: anchor ? addDays(anchor, s.day) : null, doneOn: done[s.day] || null }));
  const next = closed ? null : steps.find((s) => !s.doneOn && s.due) || null;
  return { anchor, steps, next };
}

// What next_follow_up should be after a follow-up change. A date the owner typed in wins until the
// next step is ticked.
export const plannedFollowUp = (lead, firstAuditAt) => followUpPlan(lead, firstAuditAt).next?.due || null;

export function scoreHistory(audits) {
  const done = audits
    .filter((a) => a.status === 'complete' && a.overall_score != null)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  return done.map((a, i) => ({
    id: a.id,
    at: a.created_at,
    overall: a.overall_score,
    change: i ? a.overall_score - done[i - 1].overall_score : null,
    monthly: !!a.notes?.rescan,
    categories: Object.fromEntries(Object.entries(a.category_scores || {}).map(([k, v]) => [k, v?.score ?? null])),
  }));
}

// Care plan clients (won) whose newest review is RESCAN.everyDays old or more, oldest first.
// Leads with no site, or no review yet, are left alone: the first review is run by hand.
export function dueForRescan(leads, audits, now = new Date()) {
  const latest = {};
  for (const a of audits) if (a.lead_id && (!latest[a.lead_id] || a.created_at > latest[a.lead_id].created_at)) latest[a.lead_id] = a;
  const cutoff = now.getTime() - RESCAN.everyDays * DAY;
  return leads
    .filter((l) => l.care_plan && l.status === 'won' && l.site_url && latest[l.id])
    .filter((l) => Date.parse(latest[l.id].created_at) <= cutoff)
    .sort((a, b) => latest[a.id].created_at.localeCompare(latest[b.id].created_at))
    .map((l) => ({ lead: l, last: latest[l.id] }));
}

// A payment link pasted on a request from the report (Stripe, Square, PayPal...). Empty clears it.
export function cleanPayUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  let url;
  try { url = new URL(raw); } catch { throw new LeadInputError('That payment link does not look like a web address.'); }
  if (url.protocol !== 'https:') throw new LeadInputError('Use the https:// payment link.');
  if (raw.length > 500) throw new LeadInputError('That payment link is too long.');
  return url.href;
}

// The note Christian copies and sends once a request has a payment link.
export function payMessage(request, business) {
  const first = String(request.name || '').trim().split(/\s+/)[0] || 'there';
  const what = request.offer ? `the ${request.offer}${request.price ? ` (${request.price})` : ''}` : 'the fixes you picked';
  return [
    `Hi ${first},`,
    '',
    `Thanks for asking about ${what} for ${business}.${request.tasks?.length ? ' This covers:' : ''}`,
    ...(request.tasks || []).map((t) => `- ${t}`),
    '',
    request.payUrl ? `You can pay here when you're ready: ${request.payUrl}` : '',
    'I will start as soon as it comes through. Reply here with any questions.',
    '',
    'Christian',
  ].filter((line, i, all) => line !== '' || all[i - 1] !== '').join('\n');
}
