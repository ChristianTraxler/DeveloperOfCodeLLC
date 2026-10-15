// Words, colors and sorting for check results, shared by every screen.

// The owner's words for each result. "Fix" and "Tighten" say what to do next.
export const STATUS = {
  fail: { label: 'Fix', long: 'to fix', tone: 'text-danger', ring: 'border-danger/40 bg-danger/10 text-danger', color: 'rgb(var(--danger-rgb))' },
  warn: { label: 'Tighten', long: 'to tighten', tone: 'text-amber', ring: 'border-amber/40 bg-amber/10 text-amber', color: 'rgb(var(--amber-rgb))' },
  pass: { label: 'Working', long: 'working', tone: 'text-live', ring: 'border-live/35 bg-live/10 text-live', color: 'rgb(var(--live-rgb))' },
  skipped: { label: 'Not checked', long: 'not checked', tone: 'text-faint', ring: 'border-line2 text-mute', color: 'rgb(var(--faint-rgb))' },
  later: { label: 'Not run', long: 'not run yet', tone: 'text-faint', ring: 'border-line2 text-faint', color: 'rgb(var(--bone-rgb) / 0.13)' },
}

const SEVERITY = { fail: 0, warn: 1, skipped: 2, pass: 3 }
export const bySeverity = (a, b) => SEVERITY[a.status] - SEVERITY[b.status]

export function tally(checks) {
  const t = { pass: 0, warn: 0, fail: 0, skipped: 0 }
  for (const c of checks) t[c.status]++
  return t
}

// From the saved per-category counts on a review row, for the list (no checks loaded there).
export function tallyFromCategories(cats = {}) {
  const t = { pass: 0, warn: 0, fail: 0, skipped: 0, notRun: 0 }
  for (const c of Object.values(cats)) for (const k of Object.keys(t)) t[k] += c?.[k] || 0
  return t
}

// Only http(s) links are rendered as links.
export const httpHref = (u) => (typeof u === 'string' && /^https?:\/\//i.test(u) ? u : null)

export const domainOf = (url = '') => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

const fDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const fDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
const fTime = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })

export function when(value, now = new Date()) {
  const d = new Date(value)
  const sameDay = d.toDateString() === now.toDateString()
  const yesterday = new Date(now.getTime() - 86400000).toDateString() === d.toDateString()
  if (sameDay) return `Today, ${fTime.format(d)}`
  if (yesterday) return `Yesterday, ${fTime.format(d)}`
  return d.getFullYear() === now.getFullYear() ? fDay.format(d) : fDate.format(d)
}
export const longWhen = (value) => `${fDate.format(new Date(value))} at ${fTime.format(new Date(value))}`
export const seconds = (ms) => (ms == null ? '' : ms < 10000 ? `${(ms / 1000).toFixed(1)} seconds` : `${Math.round(ms / 1000)} seconds`)
export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
export const cx = (...parts) => parts.filter(Boolean).join(' ')
