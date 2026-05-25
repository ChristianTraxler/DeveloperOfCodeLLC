-- =========================================================
-- DOC Project Tracker — Supabase schema
-- Run this in Supabase SQL Editor for your project.
-- =========================================================

-- Projects table
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text not null default 'personal' check (category in ('client', 'personal')),
  status text not null default 'active' check (status in ('planning', 'active', 'paused', 'completed', 'archived')),
  client_name text,
  repo_url text,
  live_url text,
  hero_image_url text,
  tech_stack text[] default '{}'::text[],
  start_date date,
  target_date date,
  completed_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Progress checklist items (the core "checkmark progress as I build" feature)
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  label text not null,
  done boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Time tracking entries
create table if not exists time_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  hours numeric(6,2) not null check (hours > 0),
  note text,
  logged_on date not null default current_date,
  created_at timestamptz not null default now()
);

-- Changelog / notes timeline
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  body text not null,
  details text,
  kind text not null default 'note' check (kind in ('note', 'milestone', 'blocker', 'release')),
  created_at timestamptz not null default now()
);

-- Per-project work timer (at most one row per project)
create table if not exists timers (
  project_id uuid primary key references projects(id) on delete cascade,
  started_at timestamptz,                       -- set while running; null while paused
  accumulated_seconds int not null default 0,   -- banked from previous segments
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_tasks_project on tasks(project_id, position);
create index if not exists idx_time_project on time_entries(project_id, logged_on desc);
create index if not exists idx_notes_project on notes(project_id, created_at desc);

-- Auto-update updated_at on projects
create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_projects_touch on projects;
create trigger trg_projects_touch
  before update on projects
  for each row execute function touch_updated_at();

-- Auto-set completed_at on task done toggle
create or replace function touch_task_completed()
returns trigger as $$
begin
  if new.done = true and (old.done is null or old.done = false) then
    new.completed_at = now();
  elsif new.done = false then
    new.completed_at = null;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tasks_touch on tasks;
create trigger trg_tasks_touch
  before update on tasks
  for each row execute function touch_task_completed();

-- =========================================================
-- Storage bucket for hero images
-- =========================================================
insert into storage.buckets (id, name, public)
values ('project-images', 'project-images', true)
on conflict (id) do nothing;

-- =========================================================
-- Row Level Security
-- =========================================================
-- Single-user app: enable RLS but allow anon full access via anon key.
-- If you later add auth, replace these with auth.uid() policies.

alter table projects enable row level security;
alter table tasks enable row level security;
alter table time_entries enable row level security;
alter table notes enable row level security;
alter table timers enable row level security;

drop policy if exists "anon all projects" on projects;
create policy "anon all projects" on projects for all using (true) with check (true);

drop policy if exists "anon all tasks" on tasks;
create policy "anon all tasks" on tasks for all using (true) with check (true);

drop policy if exists "anon all time" on time_entries;
create policy "anon all time" on time_entries for all using (true) with check (true);

drop policy if exists "anon all notes" on notes;
create policy "anon all notes" on notes for all using (true) with check (true);

drop policy if exists "anon all timers" on timers;
create policy "anon all timers" on timers for all using (true) with check (true);

-- Storage policies — allow anon upload/read on project-images bucket
drop policy if exists "anon read project images" on storage.objects;
create policy "anon read project images" on storage.objects
  for select using (bucket_id = 'project-images');

drop policy if exists "anon upload project images" on storage.objects;
create policy "anon upload project images" on storage.objects
  for insert with check (bucket_id = 'project-images');

drop policy if exists "anon delete project images" on storage.objects;
create policy "anon delete project images" on storage.objects
  for delete using (bucket_id = 'project-images');
