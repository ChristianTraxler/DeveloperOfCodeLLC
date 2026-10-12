// Dates, sizes and names, written the way a person would say them.

const DAY = 86_400_000

const fmt = (opts) => new Intl.DateTimeFormat('en-US', opts)
const fTime = fmt({ hour: 'numeric', minute: '2-digit' })
const fWeekday = fmt({ weekday: 'short' })
const fWeekdayLong = fmt({ weekday: 'long' })
const fMonthDay = fmt({ month: 'short', day: 'numeric' })
const fMonthDayYear = fmt({ month: 'short', day: 'numeric', year: 'numeric' })
const fFull = fmt({ weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const fFullYear = fmt({ weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
const fQuote = fmt({ weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
const fMonth = fmt({ month: 'long' })
const fMonthYear = fmt({ month: 'long', year: 'numeric' })

export function startOfDay(ms) {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY)
export const time = (ms) => fTime.format(ms)

// Short stamp for list rows: "9:41 AM", "Yesterday", "Tue", "Oct 3", "Oct 3, 2025"
export function stamp(ms, now = Date.now()) {
  const diff = daysBetween(ms, now)
  if (diff <= 0) return fTime.format(ms)
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return fWeekday.format(ms)
  return new Date(ms).getFullYear() === new Date(now).getFullYear() ? fMonthDay.format(ms) : fMonthDayYear.format(ms)
}

// Longer stamp for an open message: "Mon, Oct 12, 9:41 AM"
export function fullStamp(ms, now = Date.now()) {
  return new Date(ms).getFullYear() === new Date(now).getFullYear() ? fFull.format(ms) : fFullYear.format(ms)
}

export const quoteDate = (ms) => `${fQuote.format(ms)} at ${fTime.format(ms)}`

// Group heading for the list: Today, Yesterday, a weekday this week, Last week, then months
export function dayGroup(ms, now = Date.now()) {
  const diff = daysBetween(ms, now)
  if (diff <= 0) return { key: 'today', label: 'Today' }
  if (diff === 1) return { key: 'yesterday', label: 'Yesterday' }
  const d = new Date(ms)
  const n = new Date(now)
  const weekStart = startOfDay(now) - n.getDay() * DAY
  if (ms >= weekStart) return { key: `wd${d.getDay()}`, label: fWeekdayLong.format(ms) }
  if (ms >= weekStart - 7 * DAY) return { key: 'lastweek', label: 'Last week' }
  if (d.getFullYear() === n.getFullYear()) return { key: `m${d.getMonth()}`, label: fMonth.format(ms) }
  return { key: `y${d.getFullYear()}m${d.getMonth()}`, label: fMonthYear.format(ms) }
}

export function ago(ms, now = Date.now()) {
  const min = Math.round((now - ms) / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const hours = Math.round(min / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.round(hours / 24)
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}

export function fileSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

export const plural = (n, one, many) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`

// "Dana Teague", or the part before the @ when there is no name
export function nameOf(address) {
  if (!address) return 'Unknown sender'
  const name = (address.name || '').trim()
  if (name) return name
  const local = (address.email || '').split('@')[0] || address.email || 'Unknown'
  return local
}

export const firstName = (address) => nameOf(address).split(/\s+/)[0]

export function initialOf(address) {
  const text = nameOf(address).replace(/[^\p{L}\p{N}]/gu, '')
  return (text[0] || '?').toUpperCase()
}

// Stable hue for a sender, so the same person always gets the same monogram tint.
// Picked from a fixed set that reads well on the dark desk (ember is kept for "me").
const HUES = [36, 96, 152, 188, 212, 248, 282, 330]
export function hueOf(text = '') {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return HUES[(h >>> 0) % HUES.length]
}

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n))
