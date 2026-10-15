// Stand-alone preview: real reviews saved from the live checks on Oct 15, 2026, no server needed.
// A "run" here replays the run screen, then opens the saved review for that site if there is one.
import fixtures from './demo/fixtures.json'

const store = { audits: fixtures.audits.map((a) => ({ ...a })), checks: fixtures.checks }
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

export async function listReviews() {
  await wait(250)
  return { audits: [...store.audits].sort((a, b) => b.created_at.localeCompare(a.created_at)), meta: fixtures.meta }
}

export async function getReview(id) {
  await wait(200)
  const audit = store.audits.find((a) => a.id === id)
  if (!audit) throw new Error('That review was deleted or never existed.')
  return { audit, checks: store.checks[id], meta: fixtures.meta }
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
