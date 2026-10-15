// Run with: npm run test:seo
// Phase 4 (leads, follow-ups, implementation requests, monthly re-scans) and the fix-it report,
// through api/seo.mjs with the same in-memory Supabase and made-up sites as seo-api.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installFakes } from './seo-fakes.mjs';

process.env.SUPABASE_URL = 'https://sb.test';
process.env.SUPABASE_ANON_KEY = 'anon';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
process.env.ADMIN_EMAILS = 'owner@example.test';
process.env.GOOGLE_PLACES_API_KEY = 'places-key';
process.env.PAGESPEED_API_KEY = '';
process.env.RESEND_API_KEY = 'resend-key';
process.env.CRON_SECRET = 'cron-secret';

const { setHostGuard } = await import('../api/_lib/seo-checks.mjs');
const { default: api } = await import('../api/seo.mjs');
const { buildFixReport } = await import('../api/_lib/seo-fixreport.mjs');
const { followUpPlan, scoreHistory, dueForRescan, cleanLead, addDays } = await import('../api/_lib/seo-leads.mjs');
setHostGuard(async () => {});

const { db, stats } = installFakes();

async function call(action, body, query = '', headers = { Authorization: 'Bearer t' }) {
  const req = new Request(`https://site.test/api/seo?action=${action}${query}`, {
    method: body ? 'POST' : 'GET',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const res = await api.fetch(req);
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error), { status: res.status });
  return data;
}
const input = { url: 'blueridge.test', business: 'Blue Ridge Wash', city: 'Hickory, NC', service: 'Pressure washing' };

test('follow-up plan, score history and re-scan picks (pure)', () => {
  const plan = followUpPlan({ status: 'audit_run', followups: {} }, '2026-10-01T15:00:00Z');
  assert.deepEqual(plan.steps.map((s) => s.due), ['2026-10-01', '2026-10-02', '2026-10-04', '2026-10-08']);
  assert.equal(plan.next.day, 0);
  const sent = followUpPlan({ status: 'report_sent', report_sent_on: '2026-10-05', followups: { 0: '2026-10-05', 1: '2026-10-06' } }, '2026-10-01');
  assert.equal(sent.next.day, 3);
  assert.equal(sent.next.due, '2026-10-08', 'counts from the day the report went out');
  assert.equal(followUpPlan({ status: 'won', followups: {} }, '2026-10-01').next, null);
  assert.equal(followUpPlan({ status: 'new', followups: {} }, null).next, null, 'no review, no dates');

  const h = scoreHistory([
    { id: 'b', status: 'complete', overall_score: 71, created_at: '2026-11-01', notes: { rescan: true } },
    { id: 'a', status: 'complete', overall_score: 58, created_at: '2026-10-01' },
    { id: 'x', status: 'failed', overall_score: null, created_at: '2026-10-15' },
  ]);
  assert.deepEqual(h.map((x) => [x.id, x.overall, x.change, x.monthly]), [['a', 58, null, false], ['b', 71, 13, true]]);

  const leads = [
    { id: 'L1', care_plan: true, status: 'won', site_url: 'https://a.test/' },
    { id: 'L2', care_plan: true, status: 'won', site_url: 'https://b.test/' },
    { id: 'L3', care_plan: false, status: 'won', site_url: 'https://c.test/' },
  ];
  const audits = [
    { lead_id: 'L1', created_at: '2026-09-01T00:00:00Z' },
    { lead_id: 'L1', created_at: '2026-10-10T00:00:00Z' },
    { lead_id: 'L2', created_at: '2026-08-20T00:00:00Z' },
    { lead_id: 'L3', created_at: '2026-01-01T00:00:00Z' },
  ];
  assert.deepEqual(dueForRescan(leads, audits, new Date('2026-10-15T00:00:00Z')).map((d) => d.lead.id), ['L2']);
  assert.throws(() => cleanLead({ business: 'X', status: 'maybe' }, { creating: true }), /status/);
  assert.throws(() => cleanLead({ business: 'X', email: 'nope' }, { creating: true }), /email/);
  assert.equal(addDays('2026-12-30', 3), '2027-01-02');
});

test('fix-it report: evidence, steps and done-when for every open code fix', async () => {
  const run = await call('run', input);
  const { markdown, filename } = await call('fixreport', null, `&id=${run.audit.id}`);
  assert.match(filename, /^seo-fixes-blue-ridge-wash-\d{4}-\d{2}-\d{2}\.md$/);
  assert.match(markdown, /^# SEO fixes for Blue Ridge Wash/);
  assert.match(markdown, /## Instructions for Claude/);
  assert.match(markdown, /Never invent business facts/);
  // The site's title is "Home": the report quotes it and gives a concrete target.
  assert.match(markdown, /Current title: "Home" \(4 characters\)/);
  assert.match(markdown, /"Pressure washing in Hickory \| Blue Ridge Wash"/);
  assert.match(markdown, /\*\*Done when:\*\*/);
  // Google Business Profile facts are passed along for the schema and NAP fixes.
  assert.match(markdown, /## Business facts from the Google Business Profile/);
  assert.match(markdown, /Phone: \(828\) 555-0100/);
  assert.match(markdown, /"@type": "LocalBusiness"/);
  // Reviews (18, under 25) is an owner job, not a code change.
  assert.match(markdown, /## Fixes outside the code \(for the owner\)[\s\S]*Google reviews/);
  const codeSection = markdown.split('## Fixes outside the code')[0];
  assert.ok(!/review request/i.test(codeSection));
  assert.ok(!markdown.includes('—'), 'no em dashes');
  // Ticked tasks drop out.
  const titleTask = run.tasks.find((t) => t.checkKey === 'title');
  await call('task', { id: titleTask.id, done: true });
  const again = await call('fixreport', null, `&id=${run.audit.id}`);
  assert.ok(!again.markdown.includes('Current title: "Home"'));
});

test('fix-it report builder handles skipped checks and no profile', () => {
  const md = buildFixReport({
    audit: { business_name: 'Solo', service: 'Roofing', city: 'Boone, NC', site_url: 'https://solo.test/', created_at: '2026-10-15T00:00:00Z', overall_score: 40, notes: { site: { rendered: true } } },
    checks: [
      { key: 'robots', label: 'robots.txt', status: 'fail', summary: 'No robots.txt file.', explanation: 'x', details: { status: 404 } },
      { key: 'page_speed', label: 'Page speed', status: 'skipped', summary: 'Not checked: no key.', details: {} },
      { key: 'https', label: 'Secure connection', status: 'pass', summary: 'Secure.', details: {} },
    ],
    tasks: [{ checkKey: 'robots', title: 'Fix robots.txt so Google can read the site', impact: 'medium', effort: 'small', done: false }],
  });
  assert.match(md, /Sitemap: https:\/\/solo\.test\/sitemap\.xml/);
  assert.match(md, /renders its content with JavaScript/);
  assert.match(md, /## Not checked[\s\S]*Page speed/);
  assert.match(md, /## Already working[\s\S]*Secure connection/);
  assert.ok(!md.includes('Business facts from the Google'));
});

test('leads: create from a review, follow-ups, history, link, request, delete', async () => {
  const run = await call('run', input);
  const made = await call('leadSave', { fromAuditId: run.audit.id, business: 'Blue Ridge Wash', contact: 'Sam', email: 'Sam@BlueRidge.test', source: 'nextdoor' });
  const id = made.lead.id;
  assert.equal(made.lead.status, 'audit_run');
  assert.equal(made.lead.email, 'sam@blueridge.test');
  assert.equal(made.lead.site, 'https://blueridge.test/');
  assert.equal(made.audits.length, 1);
  assert.equal(made.plan.next.day, 0);
  assert.equal(db.seo_leads[0].next_follow_up, made.plan.next.due);

  // Tick day 0: the report is out, the status moves on, day 1 is next.
  const sent = await call('followup', { id, day: 0, done: true });
  assert.equal(sent.lead.status, 'report_sent');
  assert.ok(sent.lead.reportSentOn);
  assert.equal(sent.plan.next.day, 1);
  assert.equal(sent.lead.nextFollowUp, sent.plan.next.due);
  assert.equal(sent.lead.lastContact, sent.lead.reportSentOn);
  await assert.rejects(call('followup', { id, day: 2, done: true }), /does not exist/);

  // A second review filed under the lead from the start: score history has two points.
  const second = await call('run', { ...input, leadId: id });
  assert.equal(second.audit.lead_id, id);
  const one = await call('lead', null, `&id=${id}`);
  assert.equal(one.history.length, 2);
  assert.equal(typeof one.history[1].change, 'number');
  const list = await call('leads');
  assert.equal(list.leads[0].reviews, 2);
  assert.equal(list.leads[0].latestScore, second.audit.overall_score);
  await assert.rejects(call('run', { ...input, leadId: '00000000-0000-0000-0000-000000000000' }), /lead was deleted/);

  // Won stops the follow-ups.
  const won = await call('leadSave', { id, status: 'won', carePlan: true });
  assert.equal(won.lead.nextFollowUp, null);
  assert.equal(won.plan.next, null);

  // Request implementation from the client page: only on a reviewed report.
  const token = db.seo_audits.find((a) => a.id === run.audit.id).share_token;
  const pub = (body) => call('request', body, `&t=${token}`, {});
  await assert.rejects(pub({ name: 'Sam', email: 'sam@blueridge.test', tasks: [1] }), /not available/);
  await call('review', { id: run.audit.id, reviewed: true });
  const shared = await (await api.fetch(new Request(`https://site.test/api/seo?action=share&t=${token}`))).json();
  assert.equal(shared.tasks[0].order, 1);
  assert.equal(shared.offers.find((o) => o.key === 'implementation').payable, false);
  assert.ok(!JSON.stringify(shared.offers).includes('payUrl'));
  await assert.rejects(pub({ name: 'Sam', tasks: [1] }), /email or phone/);
  await assert.rejects(pub({ name: 'Sam', email: 'sam@blueridge.test', tasks: [999] }), /at least one/);
  const before = stats.emails.length;
  const ok = await pub({ name: 'Sam', email: 'sam@blueridge.test', tasks: [1, 2], offer: 'implementation', message: 'Please call after 3.' });
  assert.deepEqual(ok, { ok: true, payUrl: null });
  const mail = stats.emails[before];
  assert.match(mail.subject, /Implementation request: Blue Ridge Wash/);
  assert.equal(mail.reply_to, 'sam@blueridge.test');
  assert.match(mail.text, /Implementation Package/);
  assert.match(mail.text, new RegExp(`#/leads/${id}`));
  assert.equal(db.seo_requests.at(-1).emailed, true);
  assert.equal(db.seo_requests.at(-1).tasks.length, 2);
  // The honeypot looks fine to a bot but saves nothing.
  const count = db.seo_requests.length;
  await pub({ name: 'Bot', email: 'b@b.test', tasks: [1], website: 'spam' });
  assert.equal(db.seo_requests.length, count);
  const withReq = await call('lead', null, `&id=${id}`);
  assert.equal(withReq.requests[0].offer, 'Implementation Package');

  // Unlink a review, then delete the lead: the reviews stay.
  await call('link', { auditId: second.audit.id, leadId: null });
  assert.equal((await call('lead', null, `&id=${id}`)).audits.length, 1);
  await call('leadDelete', { id });
  assert.equal(db.seo_leads.length, 0);
  assert.ok(db.seo_audits.find((a) => a.id === run.audit.id));
  assert.equal(db.seo_audits.find((a) => a.id === run.audit.id).lead_id, null);
});

test('cron: needs the secret, re-scans a care plan client a month on, and emails the change', async () => {
  await assert.rejects(call('cron', null, '', {}), /Not allowed/);
  const lead = (await call('leadSave', { business: 'Blue Ridge Wash', site: 'https://blueridge.test/', city: 'Hickory, NC', service: 'Pressure washing', status: 'won', carePlan: true })).lead;
  const run = await call('run', { ...input, leadId: lead.id });
  // Not due yet.
  assert.deepEqual((await call('cron', null, '', { Authorization: 'Bearer cron-secret' })).ran, []);
  // Pretend the review is 31 days old.
  db.seo_audits.find((a) => a.id === run.audit.id).created_at = new Date(Date.now() - 31 * 86_400_000).toISOString();
  const before = stats.emails.length;
  const out = await call('cron', null, '', { Authorization: 'Bearer cron-secret' });
  assert.equal(out.ran.length, 1);
  assert.equal(out.ran[0].before, run.audit.overall_score);
  const fresh = db.seo_audits.filter((a) => a.lead_id === lead.id);
  assert.equal(fresh.length, 2);
  assert.equal(fresh.at(-1).notes.rescan, true);
  assert.match(stats.emails[before].subject, /Monthly SEO re-scan: Blue Ridge Wash/);
  const one = await call('lead', null, `&id=${lead.id}`);
  assert.equal(one.history.at(-1).monthly, true);
});
