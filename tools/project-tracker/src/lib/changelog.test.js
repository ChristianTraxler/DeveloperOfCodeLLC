import { describe, it, expect } from 'vitest'
import { groupNotesByMonth } from './changelog'

// Build a note with a created_at on a given local Y/M/D.
const note = (id, y, m, d) => ({ id, created_at: new Date(y, m - 1, d).toISOString() })

describe('groupNotesByMonth', () => {
  it('keeps current-month notes in `current` and older ones in `archived`', () => {
    const now = new Date(2026, 4, 25) // May 25, 2026
    const may = note('may', 2026, 5, 3)
    const apr = note('apr', 2026, 4, 10)

    const { current, archived } = groupNotesByMonth([may, apr], now)

    expect(current.notes.map(n => n.id)).toEqual(['may'])
    expect(archived).toHaveLength(1)
    expect(archived[0].year).toBe(2026)
    expect(archived[0].months.map(mo => mo.label)).toEqual(['April'])
    expect(archived[0].months[0].notes.map(n => n.id)).toEqual(['apr'])
  })

  it('labels the current month as "Month YYYY"', () => {
    const { current } = groupNotesByMonth([], new Date(2026, 4, 1))
    expect(current.key).toBe('2026-05')
    expect(current.label).toBe('May 2026')
  })

  it('groups archived notes by year then month, newest first', () => {
    const now = new Date(2026, 4, 15)
    const notes = [
      note('a', 2026, 4, 20),
      note('b', 2026, 3, 5),
      note('c', 2025, 12, 31),
    ]

    const { archived } = groupNotesByMonth(notes, now)

    expect(archived.map(y => y.year)).toEqual([2026, 2025])
    expect(archived[0].months.map(m => m.label)).toEqual(['April', 'March'])
    expect(archived[1].months.map(m => m.label)).toEqual(['December'])
  })

  it('returns an empty current section when no notes fall in this month', () => {
    const now = new Date(2026, 4, 25)
    const { current, archived } = groupNotesByMonth([note('apr', 2026, 4, 9)], now)

    expect(current.notes).toEqual([])
    expect(archived[0].months[0].notes.map(n => n.id)).toEqual(['apr'])
  })

  it('sorts notes newest-first regardless of input order', () => {
    const now = new Date(2026, 4, 25)
    const notes = [note('older', 2026, 3, 1), note('newer', 2026, 4, 28)]

    const { archived } = groupNotesByMonth(notes, now)

    // April (newer) must come before March (older)
    expect(archived[0].months.map(m => m.label)).toEqual(['April', 'March'])
  })

  it('files a note by its own month at the month boundary', () => {
    const now = new Date(2026, 4, 25)
    const firstOfMonth = note('first', 2026, 5, 1)
    const lastOfPrev = note('last', 2026, 4, 30)

    const { current, archived } = groupNotesByMonth([firstOfMonth, lastOfPrev], now)

    expect(current.notes.map(n => n.id)).toEqual(['first'])
    expect(archived[0].months[0].label).toBe('April')
    expect(archived[0].months[0].notes.map(n => n.id)).toEqual(['last'])
  })

  it('shows an April 2026 note under Archived › 2026 › April when viewed in May 2026', () => {
    const now = new Date(2026, 4, 25) // viewing on May 25, 2026
    const mayNote = note('may-note', 2026, 5, 20)
    const aprNote = note('apr-note', 2026, 4, 12)

    const { current, archived } = groupNotesByMonth([mayNote, aprNote], now)

    // Current section is May 2026 and holds only the May note
    expect(current.label).toBe('May 2026')
    expect(current.notes.map(n => n.id)).toEqual(['may-note'])

    // The April note has tucked into the archive under 2026 › April
    const year = archived.find(y => y.year === 2026)
    const april = year.months.find(m => m.label === 'April')
    expect(april.key).toBe('2026-04')
    expect(april.notes.map(n => n.id)).toEqual(['apr-note'])
  })

  it('provides a per-month key and notes count usable by the UI', () => {
    const now = new Date(2026, 4, 25)
    const notes = [note('a', 2026, 4, 20), note('b', 2026, 4, 2)]

    const { archived } = groupNotesByMonth(notes, now)
    const april = archived[0].months[0]

    expect(april.key).toBe('2026-04')
    expect(april.notes).toHaveLength(2)
  })
})
