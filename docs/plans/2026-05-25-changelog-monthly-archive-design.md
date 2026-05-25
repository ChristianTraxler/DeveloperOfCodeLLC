# Changelog monthly archive — design

**Date:** 2026-05-25
**Scope:** Project Tracker → Project detail page → "Notes & Changelog" timeline

## Problem

Each project's changelog (the `notes` timeline on the project detail page) grows
without bound. Over time the section becomes cluttered with every note ever
written. We want older notes to tuck into a clean, collapsible archive so the
main changelog only shows what's current.

## Behavior

- The **current calendar month** renders at the top, always expanded. This is
  the main, uncluttered changelog.
- An **"Archived"** section sits below it, **collapsed by default** so it adds no
  visual clutter. Expanding it reveals a **Year → Month** tree.
- A note is filed under the month matching **its own date** (`created_at`) — not
  by when it archived. So a note from April always lives under `2026 › April`.
- A note moves from "current" into the archive **on its own** the moment the
  calendar leaves its month. No button, no migration, no scheduled job — the
  split is purely derived from each note's date and `new Date()` at render time.
- Months collapse to a header + count (e.g. `April (5)`); click to reveal notes.
- Notes keep their existing rendering: kind icon, kind label, timestamp,
  expandable `details`, and delete-on-hover.

### Layout

```
Notes & Changelog
[ what changed? ____________ ] [Add]      ← add form, unchanged

May 2026                                   ← current month, always open
  ● Fixed card overflow              2m ago
  ● Shipped v2 release                May 3

▾ Archived  (16)                           ← collapsed by default
    2026
      ▸ April      (5)                      ← month collapses to a count
      ▸ March      (3)
    2025
      ▸ December   (8)
```

## Implementation

**No database change.** The `notes` table and the fetch in
`tools/project-tracker/src/hooks/useProjects.js` (line ~64, ordered
`created_at DESC`) stay as-is. All work is in
`tools/project-tracker/src/pages/ProjectDetail.jsx`, inside `NotesTimeline`.

### Grouping (pure function, unit-tested)

- Compute the current month key once: `YYYY-MM` from `new Date()`.
- Partition the already-sorted notes:
  - `created_at` month === current key → **current**
  - otherwise → **archived**
- Bucket archived into an ordered `Year → Month → notes[]` structure. Years and
  months come out descending naturally because the source list is newest-first.

### Rendering

- **Current month:** header (`"May 2026"`) + existing `<NoteItem>` list, always
  open.
- **Archived:** one toggle (`▸/▾ Archived (count)`), collapsed by default. When
  open, map years → month rows; each month row is its own toggle showing
  `Month (count)`, expanding to its `<NoteItem>`s.
- Collapse state in local component state: `archiveOpen` boolean + a `Set` of
  open `YYYY-MM` month keys. No persistence needed.

### Edge cases

- No notes at all → existing "No notes yet." empty state.
- Notes exist but none in the current month → current section shows a small
  "No notes this month yet." line; archive holds the history.
- The live git-commit subscription already calls `refetchNotes()`, so a new
  commit lands in the current-month section automatically.

## Verification

- Unit test for the grouping function: current vs archived split, year/month
  bucketing, and the boundary at the first of the month.
- Manual check in the running tracker (admin → Tracker → a project with notes
  spanning multiple months).
