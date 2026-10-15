// The ONLY file that talks to the backend (api/seo.mjs on the same site).
// Reviews and their checks are saved in Supabase by the server.
import { getToken } from '../../app/session.js'

const ENDPOINT = '/api/seo'

async function call(action, { body, query = '' } = {}) {
  const token = await getToken()
  let res
  try {
    res = await fetch(`${ENDPOINT}?action=${action}${query}`, {
      method: body ? 'POST' : 'GET',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.')
  }
  const data = await res.json().catch(() => null)
  if (res.status === 504) throw new Error('The review took longer than a minute and was stopped. Try again, or check the site loads in a browser.')
  if (!res.ok) throw new Error(data?.error || `Something went wrong (${res.status}).`)
  return data
}

export const listReviews = () => call('list')
export const getReview = (id) => call('get', { query: `&id=${encodeURIComponent(id)}` })
export const runReview = (input) => call('run', { body: input })
export const deleteReview = (id) => call('delete', { body: { id } })
export const setReviewed = (id, reviewed) => call('review', { body: { id, reviewed } })
export const setTaskDone = (id, done) => call('task', { body: { id, done } })

// Phase 3: the local layer.
export const runCompetitor = (id, competitorId) => call('competitor', { body: { id, competitorId } })
export const compareCompetitors = (id) => call('compare', { body: { id } })
export const addCompetitor = (id, name, url) => call('competitorAdd', { body: { id, name, url } })
export const removeCompetitor = (id, competitorId) => call('competitorRemove', { body: { id, competitorId } })
export const pickPlace = (id, placeId) => call('place', { body: { id, placeId } })
export const setRank = (id, position, keyword) => call('rank', { body: { id, position, keyword } })

// Phase 4: the fix-it report and leads.
export const getFixReport = (id) => call('fixreport', { query: `&id=${encodeURIComponent(id)}` })
export const listLeads = () => call('leads')
export const getLead = (id) => call('lead', { query: `&id=${encodeURIComponent(id)}` })
export const saveLead = (lead) => call('leadSave', { body: lead })
export const setFollowUp = (id, day, done) => call('followup', { body: { id, day, done } })
export const linkReview = (auditId, leadId) => call('link', { body: { auditId, leadId } })
export const deleteLead = (id) => call('leadDelete', { body: { id } })
