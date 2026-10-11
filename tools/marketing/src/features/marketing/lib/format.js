// Dates, numbers and plurals, written the way a person would say them.

const DAY = 24 * 60 * 60 * 1000

export const plural = (n, one, many) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`
export const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0)

const fmt = (opts) => new Intl.DateTimeFormat('en-US', opts)
const fWeekdayShort = fmt({ weekday: 'short' })
const fWeekdayLong = fmt({ weekday: 'long' })
const fMonthDay = fmt({ month: 'short', day: 'numeric' })
const fMonthDayYear = fmt({ month: 'short', day: 'numeric', year: 'numeric' })
const fTime = fmt({ hour: 'numeric', minute: '2-digit' })
const fMonthLong = fmt({ month: 'long' })

export const asDate = (value) => (value instanceof Date ? value : new Date(value))

export function startOfDay(value) {
  const d = new Date(asDate(value))
  d.setHours(0, 0, 0, 0)
  return d
}

export function addDays(value, days) {
  const d = new Date(asDate(value))
  d.setDate(d.getDate() + days)
  return d
}

export function addMinutes(value, minutes) {
  return new Date(asDate(value).getTime() + minutes * 60000)
}

export function atTime(value, hours, minutes = 0) {
  const d = new Date(asDate(value))
  d.setHours(hours, minutes, 0, 0)
  return d
}

export const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY)
export const daysSince = (value, now = new Date()) => (value ? (asDate(now) - asDate(value)) / DAY : Infinity)
export const monthsSince = (value, now = new Date()) => daysSince(value, now) / 30.44

export function nextWeekday(now, weekday, hours = 9, minutes = 0) {
  const base = asDate(now)
  for (let i = 1; i <= 7; i++) {
    const d = atTime(addDays(base, i), hours, minutes)
    if (d.getDay() === weekday) return d
  }
  return atTime(addDays(base, 7), hours, minutes)
}

export const monthName = (value) => fMonthLong.format(asDate(value))
export const time = (value) => fTime.format(asDate(value))
export const weekdayShort = (value) => fWeekdayShort.format(asDate(value))

export function shortDate(value, now = new Date()) {
  const d = asDate(value)
  return d.getFullYear() === asDate(now).getFullYear() ? fMonthDay.format(d) : fMonthDayYear.format(d)
}

export const dayDate = (value, now = new Date()) => `${fWeekdayShort.format(asDate(value))}, ${shortDate(value, now)}`

// "Today", "Tomorrow", "Yesterday", "Thursday" (within a week), otherwise "Thu, Oct 22"
export function relativeDay(value, now = new Date()) {
  const diff = daysBetween(now, value)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff > 1 && diff < 7) return fWeekdayLong.format(asDate(value))
  return dayDate(value, now)
}

export const relativeDayTime = (value, now = new Date()) => `${relativeDay(value, now)} at ${time(value)}`

export function ago(value, now = new Date()) {
  const ms = asDate(now) - asDate(value)
  const min = Math.round(ms / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const hours = Math.round(min / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'} ago`
  return shortDate(value, now)
}

export function compact(n) {
  if (n >= 10000) return `${Math.round(n / 1000)}K`
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`
  return n.toLocaleString('en-US')
}

export function timeZoneLabel() {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName')
    return part ? part.value : ''
  } catch {
    return ''
  }
}

// Value for <input type="date"> and <input type="time"> in local time
export const toDateInput = (value) => {
  const d = asDate(value)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const toTimeInput = (value) => {
  const d = asDate(value)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
export function fromInputs(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm] = timeStr.split(':').map(Number)
  const out = new Date(y, m - 1, d, hh, mm, 0, 0)
  return Number.isNaN(out.getTime()) ? null : out
}

export const initials = (first = '', last = '') => `${(first[0] || '').toUpperCase()}${(last[0] || '').toUpperCase()}` || '?'
