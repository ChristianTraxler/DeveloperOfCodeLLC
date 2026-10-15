// The client report's only call: one reviewed review by its share token. No sign in, and it
// never loads the admin's Supabase client.
export const isDemo = import.meta.env.VITE_SEO_DEMO === '1'

export async function getShare(token) {
  if (isDemo) {
    const { default: fixtures } = await import('../demo/fixtures.json')
    const view = fixtures.shares[token] || Object.values(fixtures.shares)[0]
    return view
  }
  let res
  try {
    res = await fetch(`/api/seo?action=share&t=${encodeURIComponent(token)}`)
  } catch {
    throw new Error('Could not load the report. Check your connection and try again.')
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error || 'This report is not available.')
  return data
}

// /seo/<token> on the live site, or ?t=<token> in local dev.
export function tokenFromLocation(loc = window.location) {
  const fromPath = /\/seo\/([A-Za-z0-9_-]+)\/?$/.exec(loc.pathname)?.[1]
  return fromPath || new URLSearchParams(loc.search).get('t') || ''
}
