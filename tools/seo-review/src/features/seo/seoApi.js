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
