// Stand-alone preview: real reviews saved from the live checks on Oct 15, 2026, no server needed.
// A "run" here replays the run screen, then opens the saved review for that site if there is one.
import fixtures from './demo/fixtures.json'
import { buildFixReport, fixReportFilename } from '../../../../../api/_lib/seo-fixreport.mjs'
import { LEAD_STATUSES, LEAD_SOURCES, FOLLOW_UPS, RESCAN } from '../../../../../api/_lib/seo-config.mjs'
import { cleanLead, followUpPlan, plannedFollowUp, scoreHistory, today } from '../../../../../api/_lib/seo-leads.mjs'

const store = { audits: fixtures.audits.map((a) => ({ ...a })), checks: structuredClone(fixtures.checks), tasks: structuredClone(fixtures.tasks), competitors: {}, ranks: {} }
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

export async function listReviews() {
  await wait(250)
  return { audits: [...store.audits].sort((a, b) => b.created_at.localeCompare(a.created_at)), leads: leads.map((l) => ({ id: l.id, business: l.business_name })), meta: meta() }
}

export async function getReview(id) {
  await wait(200)
  const audit = store.audits.find((a) => a.id === id)
  if (!audit) throw new Error('That review was deleted or never existed.')
  return { audit, checks: store.checks[id], tasks: store.tasks[id] || [], competitors: store.competitors[id] || [], ranks: store.ranks[id] || [], meta: meta() }
}

export async function setReviewed(id, reviewed) {
  await wait(200)
  const audit = store.audits.find((a) => a.id === id)
  audit.reviewed_at = reviewed ? new Date().toISOString() : null
  return { ok: true, reviewedAt: audit.reviewed_at }
}

export async function setTaskDone(id, done) {
  await wait(120)
  for (const list of Object.values(store.tasks)) for (const t of list) if (t.id === id) t.done = done
  return { ok: true }
}

const host = (u) => String(u).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]

export async function runReview(input) {
  const match = store.audits.find((a) => host(a.site_url) === host(input.url))
  await wait(match ? match.duration_ms + 1500 : 4200)
  if (!match) throw new Error('This preview cannot reach live sites. Try developerofcode.com, renegadewellnesscenter.com or washeduppressure.com to see a saved review.')
  return getReview(match.id)
}

export async function deleteReview(id) {
  await wait(200)
  store.audits = store.audits.filter((a) => a.id !== id)
  return { ok: true }
}

// ── Phase 3 in the preview ──────────────────────────────────────────────────
// Google Places is not set up here. Competitors can be added by hand, but only the sites with a
// saved review (their real saved checks stand in for a fresh run). Scores are not recalculated.

let nextId = 1000
const upsertCheck = (id, check) => {
  store.checks[id] = [...store.checks[id].filter((c) => c.key !== check.key), check]
}

export async function addCompetitor(id, name, url) {
  await wait(200)
  const list = (store.competitors[id] ||= [])
  if (list.length >= 3) throw new Error('A review compares up to 3 competitors. Remove one first.')
  const match = store.audits.find((a) => host(a.site_url) === host(url))
  if (!match || match.id === id) throw new Error('This preview can only compare the other saved reviews: developerofcode.com, renegadewellnesscenter.com or washeduppressure.com.')
  const competitor = { id: nextId++, name: name || host(url), site: match.site_url, position: null, status: 'pending', error: null, place: null, statuses: {}, overall: null, manual: true }
  list.push(competitor)
  return { competitor }
}

export async function runCompetitor(id, competitorId) {
  await wait(1600)
  const c = (store.competitors[id] || []).find((x) => x.id === competitorId)
  const match = store.audits.find((a) => host(a.site_url) === host(c.site))
  Object.assign(c, { status: 'complete', statuses: Object.fromEntries(store.checks[match.id].map((k) => [k.key, k.status])), overall: match.overall_score })
  return { competitor: c }
}

const PTS = { pass: 1, warn: 0.5, fail: 0 }
export async function compareCompetitors(id) {
  await wait(200)
  const done = (store.competitors[id] || []).filter((c) => c.status === 'complete')
  store.checks[id] = store.checks[id].filter((c) => c.key !== 'competitors')
  if (done.length) {
    const rows = store.checks[id]
      .filter((c) => PTS[c.status] != null && c.key !== 'rank')
      .map((c) => {
        const theirs = done.map((d) => PTS[d.statuses[c.key]]).filter((p) => p != null)
        return { key: c.key, n: theirs.length, behind: theirs.filter((p) => p > PTS[c.status]).length > theirs.length / 2, ahead: theirs.filter((p) => p < PTS[c.status]).length > theirs.length / 2 }
      })
      .filter((r) => r.n)
    const behind = rows.filter((r) => r.behind).map((r) => r.key)
    const share = behind.length / rows.length
    const status = share > 0.5 ? 'fail' : share >= 0.25 ? 'warn' : 'pass'
    upsertCheck(id, { key: 'competitors', category: 'visibility', label: 'Top 3 local competitors', status, score: PTS[status], summary: `Behind on ${behind.length} of ${rows.length} checks, ahead on ${rows.filter((r) => r.ahead).length}.`, explanation: 'In this preview the comparison uses the saved reviews of the other sites.', impact: 'medium', effort: 'large', service: 'Website Care + Local SEO', details: { compared: rows.length, behind, ahead: rows.filter((r) => r.ahead).map((r) => r.key), competitors: done.map((d) => d.name) } })
  }
  return getReview(id)
}

export async function removeCompetitor(id, competitorId) {
  store.competitors[id] = (store.competitors[id] || []).filter((c) => c.id !== competitorId)
  return compareCompetitors(id)
}

export async function pickPlace() {
  throw new Error('Google Places is not set up in this preview.')
}

export async function setRank(id, position, keyword) {
  await wait(200)
  const audit = store.audits.find((a) => a.id === id)
  const kw = keyword || `${audit.service} ${audit.city.split(',')[0]}`.toLowerCase()
  const status = position == null || position > 10 ? 'fail' : position > 3 ? 'warn' : 'pass'
  const summary = position == null || position > 10 ? `Not in the top 10 for "${kw}".` : `Number ${position} for "${kw}".`
  upsertCheck(id, { key: 'rank', category: 'visibility', label: 'Rank for service and city', status, score: PTS[status], summary, explanation: 'Entered by hand from a Google search.', impact: 'high', effort: 'large', service: 'Website Care + Local SEO', details: { keyword: kw, position } })
  ;(store.ranks[id] ||= []).unshift({ keyword: kw, rank_position: position, checked_on: new Date().toISOString().slice(0, 10) })
  return getReview(id)
}

// ── Phase 4 in the preview: leads and the fix-it report ─────────────────────
// One sample lead, filed under the saved Washed Up review. Changes last until the page reloads.

const meta = () => ({ ...fixtures.meta, leadStatuses: LEAD_STATUSES, leadSources: LEAD_SOURCES, followUps: FOLLOW_UPS, rescanDays: RESCAN.everyDays })
const washed = store.audits.find((a) => a.business_name.startsWith('Washed Up'))
const leads = [
  { id: 'demo-lead-1', business_name: 'Washed Up Pressure Washing', site_url: 'https://washeduppressure.com/', city: 'Hickory, NC', service: 'Pressure washing', contact_name: 'Owner', email: null, phone: null, source: 'facebook', status: 'report_sent', care_plan: false, last_contact: washed.created_at.slice(0, 10), next_follow_up: null, report_sent_on: washed.created_at.slice(0, 10), followups: { 0: washed.created_at.slice(0, 10) }, notes: 'Asked about the speed score. Follow up with the image fixes.', created_at: washed.created_at, updated_at: washed.created_at },
]
washed.lead_id = 'demo-lead-1'
const firstAt = (id) => store.audits.filter((a) => a.lead_id === id).map((a) => a.created_at).sort()[0] || null
leads[0].next_follow_up = plannedFollowUp(leads[0], firstAt('demo-lead-1'))

const toLead = (l) => ({ id: l.id, business: l.business_name, site: l.site_url, city: l.city, service: l.service, contact: l.contact_name, email: l.email, phone: l.phone, source: l.source, status: l.status, carePlan: l.care_plan, lastContact: l.last_contact, nextFollowUp: l.next_follow_up, reportSentOn: l.report_sent_on, followups: l.followups, notes: l.notes, createdAt: l.created_at })

export async function getFixReport(id) {
  const view = await getReview(id)
  return { markdown: buildFixReport(view), filename: fixReportFilename(view.audit) }
}

export async function listLeads() {
  await wait(200)
  return {
    leads: leads.map((l) => {
      const mine = store.audits.filter((a) => a.lead_id === l.id).sort((a, b) => b.created_at.localeCompare(a.created_at))
      return { ...toLead(l), reviews: mine.length, latestScore: mine[0]?.overall_score ?? null, latestAuditId: mine[0]?.id || null, lastReviewAt: mine[0]?.created_at || null }
    }),
    meta: meta(),
  }
}

export async function getLead(id) {
  await wait(150)
  const l = leads.find((x) => x.id === id)
  if (!l) throw new Error('That lead was deleted or never existed.')
  const audits = store.audits.filter((a) => a.lead_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at))
  return {
    lead: toLead(l),
    audits: audits.map((a) => ({ id: a.id, site: a.final_url || a.site_url, status: a.status, overall: a.overall_score, createdAt: a.created_at, reviewedAt: a.reviewed_at, monthly: !!a.notes?.rescan })),
    history: scoreHistory(audits),
    plan: followUpPlan(l, firstAt(id)),
    requests: [],
    meta: meta(),
  }
}

export async function saveLead(body) {
  await wait(200)
  const fields = cleanLead(body, { creating: !body.id })
  if (body.id) {
    const l = leads.find((x) => x.id === body.id)
    if ((fields.status === 'won' || fields.status === 'lost') && !('nextFollowUp' in body)) fields.next_follow_up = null
    Object.assign(l, fields)
    return getLead(l.id)
  }
  const l = { id: `demo-lead-${Date.now()}`, followups: {}, notes: '', care_plan: false, created_at: new Date().toISOString(), ...fields }
  const audit = body.fromAuditId && store.audits.find((a) => a.id === body.fromAuditId)
  if (audit) {
    Object.assign(l, { site_url: l.site_url ?? audit.site_url, city: l.city ?? audit.city, service: l.service ?? audit.service, status: l.status === 'new' ? 'audit_run' : l.status })
    audit.lead_id = l.id
    l.next_follow_up = plannedFollowUp(l, audit.created_at)
  }
  leads.push(l)
  return getLead(l.id)
}

export async function setFollowUp(id, day, done) {
  const l = leads.find((x) => x.id === id)
  const stamp = today()
  l.followups = { ...l.followups }
  if (done) {
    l.followups[day] = stamp
    l.last_contact = stamp
    if (day === 0) {
      l.report_sent_on ||= stamp
      if (l.status === 'new' || l.status === 'audit_run') l.status = 'report_sent'
    }
  } else delete l.followups[day]
  l.next_follow_up = plannedFollowUp(l, firstAt(id))
  return getLead(id)
}

export async function linkReview(auditId, leadId) {
  await wait(150)
  store.audits.find((a) => a.id === auditId).lead_id = leadId
  return { ok: true }
}

export async function deleteLead(id) {
  await wait(150)
  leads.splice(leads.findIndex((l) => l.id === id), 1)
  for (const a of store.audits) if (a.lead_id === id) a.lead_id = null
  return { ok: true }
}

// ── The Google profile typed in by hand, in the preview ─────────────────────
// Graded with the same thresholds as the server, kept simple here.

export async function checkMapsLink(url) {
  await wait(250)
  const name = /\/maps\/place\/([^/@]+)/.exec(url)?.[1]
  return { url, name: name ? decodeURIComponent(name.replace(/\+/g, ' ')) : null, resolved: !/goo\.gl|share\.google|g\.page/.test(url) }
}

export async function saveProfile(id, p) {
  await wait(300)
  const audit = store.audits.find((a) => a.id === id)
  const local = (audit.notes.local ||= {})
  if (p.none) {
    local.manual = { none: true, place: null, enteredAt: new Date().toISOString() }
    upsertCheck(id, { key: 'gbp', category: 'local', label: 'Google Business Profile', status: 'fail', score: 0, summary: 'No Google Business Profile found.', explanation: 'Marked as having no profile.', impact: 'high', effort: 'medium', service: 'Google Business Profile setup', details: { found: false } })
    store.checks[id] = store.checks[id].filter((c) => c.key !== 'reviews')
    return getReview(id)
  }
  if (!String(p.name || '').trim()) throw new Error('Enter the business name as it shows on Google.')
  const reviews = Number(p.reviews || 0)
  const rating = p.rating === '' || p.rating == null ? null : Number(p.rating)
  const hours = String(p.hours || '').split('\n').map((l) => l.trim()).filter(Boolean)
  const place = { manual: true, name: p.name, address: p.address || null, phone: p.phone || null, website: p.website || null, category: p.category || null, rating: reviews ? rating : null, reviews, photos: Number(p.photos || 0), hours, hoursListed: hours.length > 0 || !!p.hoursListed, status: p.status || 'OPERATIONAL', mapsUrl: p.link || null }
  local.manual = { place, link: p.link ? { url: p.link } : null, enteredAt: new Date().toISOString() }
  const has = { hours: place.hoursListed, photos: place.photos > 0, website: !!place.website, category: !!place.category }
  const missing = Object.keys(has).filter((k) => !has[k])
  const gbp = missing.length ? 'fail' : 'pass'
  const rv = reviews < 10 || (rating ?? 0) < 4 ? 'fail' : reviews < 25 || rating < 4.5 ? 'warn' : 'pass'
  upsertCheck(id, { key: 'gbp', category: 'local', label: 'Google Business Profile', status: gbp, score: PTS[gbp], summary: missing.length ? `The profile is missing ${missing.join(', ')}.` : `Complete profile listed as ${place.category}.`, explanation: 'From the profile details entered by hand.', impact: 'high', effort: 'medium', service: 'Google Business Profile setup', details: { found: true, manual: true, ...place, has } })
  upsertCheck(id, { key: 'reviews', category: 'local', label: 'Google reviews', status: rv, score: PTS[rv], summary: `${reviews} reviews, ${rating == null ? 'no rating' : `a ${rating.toFixed(1)} rating`}.`, explanation: 'From the profile details entered by hand.', impact: 'high', effort: 'large', service: 'Review request system', details: { rating, reviews } })
  return getReview(id)
}
