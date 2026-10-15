// Stand-alone preview: real reviews saved from the live checks on Oct 15, 2026, no server needed.
// A "run" here replays the run screen, then opens the saved review for that site if there is one.
import fixtures from './demo/fixtures.json'

const store = { audits: fixtures.audits.map((a) => ({ ...a })), checks: structuredClone(fixtures.checks), tasks: structuredClone(fixtures.tasks), competitors: {}, ranks: {} }
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

export async function listReviews() {
  await wait(250)
  return { audits: [...store.audits].sort((a, b) => b.created_at.localeCompare(a.created_at)), meta: fixtures.meta }
}

export async function getReview(id) {
  await wait(200)
  const audit = store.audits.find((a) => a.id === id)
  if (!audit) throw new Error('That review was deleted or never existed.')
  return { audit, checks: store.checks[id], tasks: store.tasks[id] || [], competitors: store.competitors[id] || [], ranks: store.ranks[id] || [], meta: fixtures.meta }
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
