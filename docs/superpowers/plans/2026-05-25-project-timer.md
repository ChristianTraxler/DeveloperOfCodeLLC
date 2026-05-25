# Project Work Timer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a start/pause/resume/stop work timer to a project's detail page; stopping pre-fills the Time Log form with the elapsed hours.

**Architecture:** A single `timers` row per project in Supabase is the source of truth (`started_at` + `accumulated_seconds`), so the timer keeps correct time across refresh, laptop-close, and other devices. Pure time math lives in a unit-tested `lib/timer.js`; the live `HH:MM:SS` readout and the Supabase mutations live inline in the `TimeLog` component, matching the existing inline-supabase pattern used by `TaskList`/`NotesTimeline`.

**Tech Stack:** React 18, Vite 5, Supabase JS, Tailwind, lucide-react, Vitest (added here).

All paths are relative to `tools/project-tracker/`.

---

## File Structure

- **Create** `supabase/add-timers.sql` — migration: the `timers` table + RLS policy.
- **Modify** `supabase/schema.sql` — fold the `timers` table + RLS into the canonical schema so fresh setups get it.
- **Create** `src/lib/timer.js` — pure helpers: `timerState`, `elapsedSeconds`, `secondsToHours`, `formatHMS`. No Supabase import (keeps it trivially testable).
- **Create** `src/lib/timer.test.js` — Vitest unit tests for the pure helpers.
- **Modify** `package.json` — add `vitest` devDependency + `test` script.
- **Modify** `src/hooks/useProjects.js` — `useProject(id)` also fetches the `timers` row and returns `timer` + `refetchTimer`.
- **Modify** `src/pages/ProjectDetail.jsx` — render the timer UI inside `TimeLog`, wire the four mutations, pre-fill `hours` on stop.

---

## Task 1: Database — `timers` table + RLS

**Files:**
- Create: `tools/project-tracker/supabase/add-timers.sql`
- Modify: `tools/project-tracker/supabase/schema.sql` (after the `notes` table block and in the RLS section)

- [ ] **Step 1: Create the migration file**

Create `tools/project-tracker/supabase/add-timers.sql`:

```sql
-- =========================================================
-- Add: per-project work timer
-- One row per project while a timer is running or paused.
--   running  -> started_at set
--   paused   -> started_at null, accumulated_seconds holds banked time
-- Elapsed = accumulated_seconds + (running ? now - started_at : 0)
-- Run this in the Supabase SQL Editor.
-- =========================================================

create table if not exists timers (
  project_id uuid primary key references projects(id) on delete cascade,
  started_at timestamptz,
  accumulated_seconds int not null default 0,
  created_at timestamptz not null default now()
);

alter table timers enable row level security;

drop policy if exists "anon all timers" on timers;
create policy "anon all timers" on timers for all using (true) with check (true);
```

- [ ] **Step 2: Fold the table into `schema.sql`**

In `tools/project-tracker/supabase/schema.sql`, immediately AFTER the `notes` table block (the `create table if not exists notes (...)` ending at the line with `);` before `-- Indexes`), insert:

```sql

-- Per-project work timer (at most one row per project)
create table if not exists timers (
  project_id uuid primary key references projects(id) on delete cascade,
  started_at timestamptz,                       -- set while running; null while paused
  accumulated_seconds int not null default 0,   -- banked from previous segments
  created_at timestamptz not null default now()
);
```

- [ ] **Step 3: Add `timers` to the RLS section of `schema.sql`**

In the Row Level Security section, after the line `alter table notes enable row level security;` add:

```sql
alter table timers enable row level security;
```

And after the `notes` policy block (`create policy "anon all notes" ...`) add:

```sql

drop policy if exists "anon all timers" on timers;
create policy "anon all timers" on timers for all using (true) with check (true);
```

- [ ] **Step 4: Commit**

```bash
git add tools/project-tracker/supabase/add-timers.sql tools/project-tracker/supabase/schema.sql
git commit -m "Add timers table for project work timer"
```

> **Note:** Applying this SQL to the live Supabase project is a manual step in Task 5 — code changes don't run migrations.

---

## Task 2: Pure timer helpers (TDD) + Vitest setup

**Files:**
- Modify: `tools/project-tracker/package.json`
- Test: `tools/project-tracker/src/lib/timer.test.js`
- Create: `tools/project-tracker/src/lib/timer.js`

- [ ] **Step 1: Add Vitest to the project**

Run (from `tools/project-tracker/`):

```bash
npm install -D vitest@^2.1.8
```

Then add a `test` script. In `package.json`, change the `"scripts"` block from:

```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
```

to:

```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
```

(Vitest auto-reads the existing `vite.config.js`; pure-function tests run in the default node environment, so no separate config file is needed.)

- [ ] **Step 2: Write the failing test**

Create `tools/project-tracker/src/lib/timer.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { timerState, elapsedSeconds, secondsToHours, formatHMS } from './timer'

describe('timerState', () => {
  it('is "none" when there is no timer row', () => {
    expect(timerState(null)).toBe('none')
    expect(timerState(undefined)).toBe('none')
  })
  it('is "running" when started_at is set', () => {
    expect(timerState({ started_at: new Date().toISOString(), accumulated_seconds: 0 })).toBe('running')
  })
  it('is "paused" when started_at is null', () => {
    expect(timerState({ started_at: null, accumulated_seconds: 100 })).toBe('paused')
  })
})

describe('elapsedSeconds', () => {
  it('is 0 for no timer', () => {
    expect(elapsedSeconds(null)).toBe(0)
  })
  it('returns banked seconds while paused (ignores now)', () => {
    expect(elapsedSeconds({ started_at: null, accumulated_seconds: 42 }, 9_999_999)).toBe(42)
  })
  it('adds the running segment to banked seconds', () => {
    const timer = { started_at: new Date(1_000_000).toISOString(), accumulated_seconds: 10 }
    expect(elapsedSeconds(timer, 1_005_000)).toBe(15) // +5s running
  })
  it('floors partial seconds of the running segment', () => {
    const timer = { started_at: new Date(1_000_000).toISOString(), accumulated_seconds: 0 }
    expect(elapsedSeconds(timer, 1_005_999)).toBe(5)
  })
  it('never goes negative if the clock is skewed', () => {
    const timer = { started_at: new Date(2_000_000).toISOString(), accumulated_seconds: 7 }
    expect(elapsedSeconds(timer, 1_000_000)).toBe(7)
  })
})

describe('secondsToHours', () => {
  it('converts whole hours', () => {
    expect(secondsToHours(3600)).toBe(1)
    expect(secondsToHours(5400)).toBe(1.5)
  })
  it('rounds to 2 decimals', () => {
    expect(secondsToHours(5025)).toBe(1.4)   // 1.3958… -> 1.40
    expect(secondsToHours(30)).toBe(0.01)    // 0.0083… -> 0.01
  })
  it('is 0 for 0 seconds', () => {
    expect(secondsToHours(0)).toBe(0)
  })
})

describe('formatHMS', () => {
  it('formats zero', () => {
    expect(formatHMS(0)).toBe('00:00:00')
  })
  it('formats h:m:s with zero padding', () => {
    expect(formatHMS(5025)).toBe('01:23:45')
    expect(formatHMS(3661)).toBe('01:01:01')
  })
  it('floors fractional input and clamps negatives', () => {
    expect(formatHMS(61.9)).toBe('00:01:01')
    expect(formatHMS(-5)).toBe('00:00:00')
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./timer"` (the module does not exist yet).

- [ ] **Step 4: Implement the helpers**

Create `tools/project-tracker/src/lib/timer.js`:

```js
// Pure helpers for the per-project work timer.
// A timer row is { started_at: string|null (ISO), accumulated_seconds: number }
// or null/undefined when no timer exists.

export function timerState(timer) {
  if (!timer) return 'none'
  return timer.started_at ? 'running' : 'paused'
}

// Total elapsed whole seconds. While running, add (now - started_at) to the
// banked seconds; while paused, just the banked seconds. `now` is ms epoch.
export function elapsedSeconds(timer, now = Date.now()) {
  if (!timer) return 0
  const banked = timer.accumulated_seconds || 0
  if (!timer.started_at) return banked
  const startedMs = new Date(timer.started_at).getTime()
  const running = Math.max(0, Math.floor((now - startedMs) / 1000))
  return banked + running
}

// Seconds -> decimal hours, rounded to 2 dp to match numeric(6,2).
export function secondsToHours(seconds) {
  return Math.round((seconds / 3600) * 100) / 100
}

// Seconds -> "HH:MM:SS".
export function formatHMS(seconds) {
  const s = Math.max(0, Math.floor(seconds))
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — all tests in `src/lib/timer.test.js` green.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/timer.js src/lib/timer.test.js
git commit -m "Add timer time-math helpers with Vitest"
```

---

## Task 3: Data layer — fetch the timer in `useProject`

**Files:**
- Modify: `tools/project-tracker/src/hooks/useProjects.js`

- [ ] **Step 1: Add timer state**

In `useProject(id)`, after the line `const [notes, setNotes] = useState([])` add:

```js
  const [timer, setTimer] = useState(null)
```

- [ ] **Step 2: Fetch the timer inside `refetch`**

Replace the `Promise.all` array and the following setters in `refetch` so it also loads the timer. Change:

```js
    const [{ data: p }, { data: t }, { data: te }, { data: n }] = await Promise.all([
      supabase.from('projects').select('*').eq('id', id).single(),
      supabase.from('tasks').select('*').eq('project_id', id).order('position'),
      supabase.from('time_entries').select('*').eq('project_id', id).order('logged_on', { ascending: false }),
      supabase.from('notes').select('*').eq('project_id', id).order('created_at', { ascending: false }),
    ])
    setProject(p)
    setTasks(t || [])
    setTimeEntries(te || [])
    setNotes(n || [])
    setLoading(false)
```

to:

```js
    const [{ data: p }, { data: t }, { data: te }, { data: n }, { data: tm }] = await Promise.all([
      supabase.from('projects').select('*').eq('id', id).single(),
      supabase.from('tasks').select('*').eq('project_id', id).order('position'),
      supabase.from('time_entries').select('*').eq('project_id', id).order('logged_on', { ascending: false }),
      supabase.from('notes').select('*').eq('project_id', id).order('created_at', { ascending: false }),
      supabase.from('timers').select('*').eq('project_id', id).maybeSingle(),
    ])
    setProject(p)
    setTasks(t || [])
    setTimeEntries(te || [])
    setNotes(n || [])
    setTimer(tm || null)
    setLoading(false)
```

- [ ] **Step 3: Add a focused `refetchTimer`**

After the `refetchNotes` `useCallback` block (ends at `}, [id])`), add:

```js

  const refetchTimer = useCallback(async () => {
    if (!id) return
    const { data } = await supabase
      .from('timers').select('*').eq('project_id', id).maybeSingle()
    setTimer(data || null)
  }, [id])
```

- [ ] **Step 4: Return the new values**

Change the final return of `useProject` from:

```js
  return { project, tasks, timeEntries, notes, loading, refetch }
```

to:

```js
  return { project, tasks, timeEntries, notes, timer, loading, refetch, refetchTimer }
```

- [ ] **Step 5: Verify it still builds**

Run: `npx vite build --outDir /tmp/doc-tracker-verify --emptyOutDir`
(Throwaway out dir so the committed `admin/tracker/` build is not touched.)
Expected: build succeeds, no import/syntax errors.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useProjects.js
git commit -m "Fetch per-project timer in useProject"
```

---

## Task 4: Timer UI + mutations in `ProjectDetail`

**Files:**
- Modify: `tools/project-tracker/src/pages/ProjectDetail.jsx`

- [ ] **Step 1: Update imports**

Change the React import (line 1) from:

```js
import { useState } from 'react'
```

to:

```js
import { useState, useEffect } from 'react'
```

Change the lucide-react import block to add `Play`, `Pause`, `Square`:

```js
import {
  ArrowLeft, Github, ExternalLink, Edit2, Trash2, Plus,
  Clock, Calendar, MessageSquare, CheckSquare, AlertTriangle,
  Rocket, FileText, ChevronRight, Play, Pause, Square
} from 'lucide-react'
```

After the `import TechTag from '../components/TechTag'` line, add:

```js
import { timerState, elapsedSeconds, secondsToHours, formatHMS } from '../lib/timer'
```

- [ ] **Step 2: Destructure timer from the hook**

Change:

```js
  const { project, tasks, timeEntries, notes, loading, refetch } = useProject(id)
```

to:

```js
  const { project, tasks, timeEntries, notes, timer, loading, refetch, refetchTimer } = useProject(id)
```

- [ ] **Step 3: Pass the timer into `TimeLog`**

Change the `TimeLog` usage:

```js
          <TimeLog projectId={id} entries={timeEntries} onChange={refetch} />
```

to:

```js
          <TimeLog projectId={id} entries={timeEntries} timer={timer} onChange={refetch} onTimerChange={refetchTimer} />
```

- [ ] **Step 4: Replace the `TimeLog` component**

Replace the entire `TimeLog` function (currently the block starting `function TimeLog({ projectId, entries, onChange }) {` and ending at its closing `}` before the `// Notes / changelog timeline` banner) with:

```js
function TimeLog({ projectId, entries, timer, onChange, onTimerChange }) {
  const [hours, setHours] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [now, setNow] = useState(() => Date.now())

  const state = timerState(timer)

  // Tick once a second only while running; frozen while paused or absent.
  useEffect(() => {
    if (state !== 'running') return
    const handle = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(handle)
  }, [state])

  const startTimer = async () => {
    await supabase.from('timers').insert({
      project_id: projectId,
      started_at: new Date().toISOString(),
      accumulated_seconds: 0,
    })
    setNow(Date.now())
    onTimerChange()
  }

  const pauseTimer = async () => {
    await supabase.from('timers').update({
      accumulated_seconds: elapsedSeconds(timer),
      started_at: null,
    }).eq('project_id', projectId)
    onTimerChange()
  }

  const resumeTimer = async () => {
    await supabase.from('timers').update({
      started_at: new Date().toISOString(),
    }).eq('project_id', projectId)
    setNow(Date.now())
    onTimerChange()
  }

  const stopTimer = async () => {
    const total = elapsedSeconds(timer)
    await supabase.from('timers').delete().eq('project_id', projectId)
    setHours(String(secondsToHours(total)))
    onTimerChange()
  }

  const add = async (e) => {
    e.preventDefault()
    const h = parseFloat(hours)
    if (!h || h <= 0) return
    await supabase.from('time_entries').insert({
      project_id: projectId,
      hours: h,
      note: note || null,
      logged_on: date,
    })
    setHours('')
    setNote('')
    onChange()
  }

  const remove = async (id) => {
    if (!confirm('Delete this time entry?')) return
    await supabase.from('time_entries').delete().eq('id', id)
    onChange()
  }

  return (
    <div className="surface p-6">
      <div className="flex items-center gap-2 mb-4">
        <Clock size={16} className="text-accent" />
        <h2 className="font-display font-bold text-bone">Time Log</h2>
      </div>

      {/* Work timer */}
      {state === 'none' ? (
        <button
          onClick={startTimer}
          className="btn-secondary w-full flex items-center justify-center gap-2 mb-4"
        >
          <Play size={14} /> Start timer
        </button>
      ) : (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-lg bg-ink-800/60 border border-ink-700">
          <span className="font-mono text-xl font-bold text-bone tabular-nums">
            {formatHMS(elapsedSeconds(timer, now))}
          </span>
          {state === 'running' ? (
            <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-accent">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" /> running
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted">
              <Pause size={11} /> paused
            </span>
          )}
          <div className="ml-auto flex gap-2">
            {state === 'running' ? (
              <button onClick={pauseTimer} className="btn-secondary !py-1.5 !px-3 flex items-center gap-1.5">
                <Pause size={13} /> Pause
              </button>
            ) : (
              <button onClick={resumeTimer} className="btn-secondary !py-1.5 !px-3 flex items-center gap-1.5">
                <Play size={13} /> Resume
              </button>
            )}
            <button onClick={stopTimer} className="btn-primary !py-1.5 !px-3 flex items-center gap-1.5">
              <Square size={13} /> Stop
            </button>
          </div>
        </div>
      )}

      <form onSubmit={add} className="space-y-2 mb-4">
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            step="0.25"
            min="0"
            value={hours}
            onChange={e => setHours(e.target.value)}
            placeholder="Hours"
          />
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="What did you work on? (optional)"
        />
        <button type="submit" className="btn-primary w-full" disabled={!hours}>
          Log time
        </button>
      </form>

      {entries.length === 0 ? (
        <p className="text-sm text-muted font-mono text-center py-3">No time logged yet.</p>
      ) : (
        <ul className="space-y-2 max-h-72 overflow-y-auto">
          {entries.map(e => (
            <li key={e.id} className="group flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-ink-800/50">
              <span className="text-accent font-mono text-sm font-bold whitespace-nowrap">
                {Number(e.hours).toFixed(2)}h
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted font-mono">{e.logged_on}</div>
                {e.note && <div className="text-sm text-bone mt-0.5 truncate">{e.note}</div>}
              </div>
              <button
                onClick={() => remove(e.id)}
                className="opacity-0 group-hover:opacity-100 text-muted hover:text-red-400 transition-opacity"
              >
                <Trash2 size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Verify the build compiles**

Run: `npx vite build --outDir /tmp/doc-tracker-verify --emptyOutDir`
(Throwaway out dir so the committed `admin/tracker/` build is not touched.)
Expected: build succeeds, no unused-import or syntax errors.

- [ ] **Step 6: Commit**

```bash
git add src/pages/ProjectDetail.jsx
git commit -m "Add start/pause/resume/stop work timer to Time Log"
```

---

## Task 5: Manual verification

**Files:** none (runtime verification).

- [ ] **Step 1: Apply the migration to Supabase**

Open the Supabase project's SQL Editor and run the contents of `tools/project-tracker/supabase/add-timers.sql`. Confirm the `timers` table appears with the `anon all timers` policy.

- [ ] **Step 2: Run the tracker**

Run (from `tools/project-tracker/`): `npm run dev`
Open a project's detail page. Confirm a `Start timer` button shows at the top of the Time Log card.

- [ ] **Step 3: Exercise the full flow**

- Click **Start timer** → the readout counts up every second with an orange "running" pulse.
- Click **Pause** → the clock freezes, controls become **Resume** + **Stop**.
- Refresh the page mid-pause → it returns paused at the same frozen time.
- Click **Resume**, let it run, refresh again → it keeps counting from the correct time (no reset, no drift).
- Click **Stop** → the timer disappears and the elapsed hours appear in the **Hours** field.
- Add an optional note and click **Log time** → a new entry appears in the list and the Hours summary card updates.

- [ ] **Step 4: Confirm tests still pass**

Run: `npm test`
Expected: PASS.

---

## Notes / edge cases (already handled in code)

- **Refresh while running** — `elapsedSeconds` recomputes from `started_at`; no drift.
- **Refresh while paused** — `started_at` is null, so the frozen `accumulated_seconds` shows.
- **Repeated pause/resume** — each pause banks `elapsedSeconds(timer)` into `accumulated_seconds`; resume sets a fresh `started_at`.
- **No ticking while paused** — the interval effect runs only when `state === 'running'`.
- **Sub-18-second stop** rounds hours to `0.00`; the existing `parseFloat`/`<= 0` guard in `add` blocks logging an empty entry.
