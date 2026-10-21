// Date helpers. Everything is stored as ISO strings and shown in the viewer's local time.

const DAY = 86400000

export const startOfDay = (d) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export const addDays = (d, n) => new Date(new Date(d).getTime() + n * DAY)

export const sameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime()

export const dayDiff = (a, b) => Math.round((startOfDay(a) - startOfDay(b)) / DAY)

const fmt = (opts) => new Intl.DateTimeFormat('en-US', opts)
const fWeekday = fmt({ weekday: 'short' })
const fMonthDay = fmt({ month: 'short', day: 'numeric' })
const fTime = fmt({ hour: 'numeric', minute: '2-digit' })
const fLong = fmt({ weekday: 'long', month: 'long', day: 'numeric' })

export const weekday = (d) => fWeekday.format(new Date(d))
export const monthDay = (d) => fMonthDay.format(new Date(d))
export const time = (d) => fTime.format(new Date(d))
export const longDate = (d) => fLong.format(new Date(d))

/** "Today 9:00 AM", "Tomorrow 12:30 PM", "Thu Oct 15 9:00 AM", "Oct 9" for older. */
export function when(iso, now = new Date()) {
  if (!iso) return ''
  const d = new Date(iso)
  const diff = dayDiff(d, now)
  if (diff === 0) return `Today ${time(d)}`
  if (diff === 1) return `Tomorrow ${time(d)}`
  if (diff === -1) return `Yesterday ${time(d)}`
  if (diff > 1 && diff < 7) return `${weekday(d)} ${time(d)}`
  return `${weekday(d)} ${monthDay(d)}, ${time(d)}`
}

/** "in 1d 18h", "in 40m", "2d ago" */
export function relative(iso, now = new Date()) {
  const ms = new Date(iso) - now
  const abs = Math.abs(ms)
  const m = Math.round(abs / 60000)
  const h = Math.floor(m / 60)
  const dd = Math.floor(h / 24)
  let s
  if (m < 60) s = `${m}m`
  else if (h < 24) s = `${h}h ${m % 60 ? `${m % 60}m` : ''}`.trim()
  else s = `${dd}d ${h % 24 ? `${h % 24}h` : ''}`.trim()
  return ms >= 0 ? `in ${s}` : `${s} ago`
}

/** Value for <input type="date"> and <input type="time"> from an ISO string. */
export function toInputs(iso) {
  if (!iso) return { date: '', time: '' }
  const d = new Date(iso)
  const p = (n) => String(n).padStart(2, '0')
  return { date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, time: `${p(d.getHours())}:${p(d.getMinutes())}` }
}

export function fromInputs(date, timeStr) {
  if (!date) return null
  const [y, mo, da] = date.split('-').map(Number)
  const [h, mi] = (timeStr || '09:00').split(':').map(Number)
  return new Date(y, mo - 1, da, h, mi).toISOString()
}

/** Build an ISO date `days` from today at hh:mm local. */
export function at(days, hh, mm = 0, now = new Date()) {
  const d = startOfDay(addDays(now, days))
  d.setHours(hh, mm, 0, 0)
  return d.toISOString()
}
