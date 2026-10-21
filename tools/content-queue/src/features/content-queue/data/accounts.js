// Who a post is for. The studio first, then clients. These are the starting list; businesses added
// in the tool (the "For" picker or Businesses at the bottom of the page) are saved with the queue.
// Handles are used only by the live preview.
export const DEFAULT_ACCOUNTS = [
  { id: 'doc', name: 'Developer of Code', handle: 'developerofcode', initials: 'DC', about: 'Web design and development studio, North Carolina', site: 'developerofcode.com' },
  { id: 'rwc', name: 'Renegade Wellness Center', handle: 'renegadewellness', initials: 'RW', about: 'Wellness center', site: 'renegadewellnesscenter.com' },
  { id: 'fin', name: 'Fin Atlas Apparel', handle: 'finatlasapparel', initials: 'FA', about: 'Apparel brand', site: 'finatlasapparel.com' },
]

// The studio's own account. It is the default for new posts and cannot be removed.
export const HOME_ACCOUNT = 'doc'

// Shown for a post whose business was removed, so nothing breaks.
export const UNKNOWN_ACCOUNT = { id: '', name: 'Removed business', handle: 'business', initials: '?', about: '', site: '' }

export function initialsOf(name) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '?'
  const letters = words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]
  return letters.toUpperCase()
}

// A short id from the name that does not clash with an existing one.
export function accountIdFor(name, accounts) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'business'
  const taken = new Set(accounts.map((a) => a.id))
  let id = base
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`
  return id
}

// "@Renegade Wellness" -> "renegadewellness"; "https://www.site.com/" -> "site.com"
export const cleanHandle = (v) => v.trim().replace(/^@+/, '').replace(/\s+/g, '').toLowerCase()
export const cleanSite = (v) => v.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '')
