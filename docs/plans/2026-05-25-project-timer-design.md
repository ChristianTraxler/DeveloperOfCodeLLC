# Project work timer — design

**Date:** 2026-05-25
**Scope:** Project Tracker → Project detail page → "Time Log" section

## Problem

Logging time today is manual: you finish working, then guess how many hours you
spent and type them into the Time Log form. We want to **time the work as it
happens** — start a timer when you begin, pause it for interruptions, and stop
it when you're done. Stopping hands the elapsed time straight to the existing
Time Log form so you can add a note and save.

The timer must keep correct time across a page refresh, a closed laptop, or
opening the project on another device — so its source of truth lives in Supabase,
not the browser.

## Behavior

- Each project has **at most one** timer, with three states: **running**,
  **paused**, or **none**.
- **Start** begins counting from zero.
- **Pause** freezes the readout and banks the elapsed time; **Resume** continues
  from where it left off. Pause/resume can repeat any number of times.
- **Stop** ends the timer, deletes it, and writes the total elapsed time (as
  hours) into the Time Log "Hours" field. Nothing auto-saves — you add an
  optional note, confirm the date (defaults to today), and click **Log time** as
  you do now.
- The live `HH:MM:SS` readout ticks every second while running; it is frozen
  while paused. After a refresh the displayed time is recomputed from the DB, so
  it never drifts.

### Layout

The timer renders at the **top of the Time Log card**, directly above the
existing "Log time" form, so the elapsed hours drop into the field below it on
stop.

```
Time Log
┌─────────────────────────────────────────────┐
│  ⏱  Start timer                              │   ← no timer
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  01:23:45   ● running     [ Pause ] [ Stop ] │   ← running
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  01:23:45   ⏸ paused     [ Resume ] [ Stop ] │   ← paused
└─────────────────────────────────────────────┘

[ Hours ____ ] [ date ____ ]                       ← existing form,
[ What did you work on? (optional) ____________ ]    Hours pre-filled on Stop
[ Log time ]
```

Styling follows the existing design system: `accent` orange for the running
pulse dot and primary button, `surface`/`ink` tones for the panel, `font-mono`
for the readout, matching radius and the subtle glow used on the progress bar.

## Implementation

### Database

One new table holds the single active timer per project. State is derived from
two fields — no separate status column to drift out of sync.

```sql
create table if not exists timers (
  project_id uuid primary key references projects(id) on delete cascade,
  started_at timestamptz,                       -- set while running; NULL while paused
  accumulated_seconds int not null default 0,   -- banked from previous segments
  created_at timestamptz not null default now()
);

alter table timers enable row level security;
drop policy if exists "anon all timers" on timers;
create policy "anon all timers" on timers for all using (true) with check (true);
```

State mapping and the canonical elapsed formula:

| State   | Row?  | `started_at` | Elapsed seconds                              |
|---------|-------|--------------|----------------------------------------------|
| none    | no    | —            | 0                                            |
| running | yes   | set          | `accumulated_seconds + (now − started_at)`   |
| paused  | yes   | NULL         | `accumulated_seconds`                         |

Operations:

| Action | DB write |
|--------|----------|
| Start  | insert `{ project_id, started_at: now, accumulated_seconds: 0 }` |
| Pause  | `accumulated_seconds += now − started_at`, then `started_at = NULL` |
| Resume | `started_at = now` |
| Stop   | read final elapsed, then **delete** the row |

Shipped as a migration file alongside `supabase/schema.sql`, and folded into
`schema.sql` so fresh setups get it.

### Data layer

`useProject(id)` in `tools/project-tracker/src/hooks/useProjects.js` also fetches
the `timers` row (`.maybeSingle()`, may be absent) and returns it as `timer`
plus a `refetchTimer`. The four mutations live in a small `lib/timer.js` helper;
each performs its Supabase write and the page refetches the timer afterward.

### Rendering

All UI is in `tools/project-tracker/src/pages/ProjectDetail.jsx`, inside the
`TimeLog` component:

- A `Timer` block above the form renders the correct state from the `timer` prop.
- A 1-second `setInterval` (only while running) drives the live readout; it is
  cleared on unmount and whenever the state is not running.
- On **Stop**, compute elapsed → hours (`seconds / 3600`, 2 decimals to match
  `numeric(6,2)`), set the form's `hours` state, and delete the timer. The
  existing `disabled={!hours}` guard still blocks a zero-hour save.

### Edge cases

- **Immediate stop / rounds to 0.00** — field pre-fills but the disabled guard
  prevents logging an empty entry.
- **Refresh while running** — recompute from `started_at`; no drift.
- **Refresh while paused** — `started_at` NULL, shows frozen
  `accumulated_seconds`.
- **Repeated pause/resume** — each pause banks into `accumulated_seconds`.
- **No ticking while paused** — interval runs only in the running state.

## Verification

- Add a small Vitest setup (devDependency + `vitest.config.js` + `test` script)
  as part of this work — it is not yet on `main`. Unit-test the pure pieces:
  elapsed-seconds calculation (running vs paused) and the seconds→hours
  formatting/rounding.
- Manual check in the running tracker: start → pause → resume → stop, refresh
  mid-run, then confirm the pre-filled hours and a successful Log time.

## Out of scope (YAGNI)

- Running-timer badges on the Projects list cards.
- Multiple concurrent timers per project.
- Idle detection / auto-stop.
