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
