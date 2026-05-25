// Group changelog notes into the current calendar month vs. an archive of
// earlier months. "Archived" is derived purely from each note's own date and
// `now`, so notes move into the archive on their own when the month flips — no
// stored flag, no migration, no scheduled job.

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const monthKey = (y, m) => `${y}-${String(m + 1).padStart(2, '0')}`

/**
 * @param {Array<{created_at: string}>} notes
 * @param {Date} now
 * @returns {{
 *   current: { key: string, label: string, notes: any[] },
 *   archived: Array<{ year: number, label: string, months: Array<{ key: string, label: string, notes: any[] }> }>
 * }}
 */
export function groupNotesByMonth(notes, now = new Date()) {
  const sorted = [...notes].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  )

  const curYear = now.getFullYear()
  const curMonth = now.getMonth()
  const curKey = monthKey(curYear, curMonth)

  const current = {
    key: curKey,
    label: `${MONTHS[curMonth]} ${curYear}`,
    notes: [],
  }

  // Preserve descending order via Map insertion order (input is newest-first).
  const years = new Map() // year -> Map(monthKey -> { key, label, notes })

  for (const n of sorted) {
    const d = new Date(n.created_at)
    const y = d.getFullYear()
    const m = d.getMonth()

    if (y === curYear && m === curMonth) {
      current.notes.push(n)
      continue
    }

    if (!years.has(y)) years.set(y, new Map())
    const months = years.get(y)
    const key = monthKey(y, m)
    if (!months.has(key)) months.set(key, { key, label: MONTHS[m], notes: [] })
    months.get(key).notes.push(n)
  }

  const archived = [...years.entries()].map(([year, months]) => ({
    year,
    label: String(year),
    months: [...months.values()],
  }))

  return { current, archived }
}
