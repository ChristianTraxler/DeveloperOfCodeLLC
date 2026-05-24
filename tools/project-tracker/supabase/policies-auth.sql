-- =========================================================
-- DOC Admin — authenticated-only RLS policies
-- ---------------------------------------------------------
-- Replaces the original "anon full access" policies (from schema.sql)
-- with ones that require a logged-in Supabase user. This is the real
-- lock behind the admin login: without a valid session, every query
-- to these tables is rejected by the database.
--
-- Run this AFTER schema.sql, in Supabase → SQL Editor.
-- =========================================================

-- RLS is already enabled by schema.sql; repeated here so this file is
-- safe to run on its own.
alter table projects     enable row level security;
alter table tasks        enable row level security;
alter table time_entries enable row level security;
alter table notes        enable row level security;

-- ── Drop the open anon policies ─────────────────────────────────────────────
drop policy if exists "anon all projects" on projects;
drop policy if exists "anon all tasks" on tasks;
drop policy if exists "anon all time" on time_entries;
drop policy if exists "anon all notes" on notes;

-- ── Table privileges (GRANTs) ───────────────────────────────────────────────
-- GRANTs decide whether a role may touch the table AT ALL; RLS then decides
-- which rows. This project doesn't auto-grant the standard Supabase roles, so we
-- grant explicitly to:
--   authenticated — the browser app (RLS still restricts rows)
--   service_role  — local scripts/automation, e.g. the commit changelog logger
--                   (bypasses RLS)
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public
  to authenticated, service_role;

-- Cover any tables added later, too.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;

-- Defense in depth: remove table access from anon (RLS already blocks it).
revoke all on projects     from anon;
revoke all on tasks        from anon;
revoke all on time_entries from anon;
revoke all on notes        from anon;

-- ── Authenticated-only full access ──────────────────────────────────────────
-- Single-admin app: every signed-in user is the admin.
drop policy if exists "authed all projects" on projects;
create policy "authed all projects" on projects
  for all to authenticated using (true) with check (true);

drop policy if exists "authed all tasks" on tasks;
create policy "authed all tasks" on tasks
  for all to authenticated using (true) with check (true);

drop policy if exists "authed all time" on time_entries;
create policy "authed all time" on time_entries
  for all to authenticated using (true) with check (true);

drop policy if exists "authed all notes" on notes;
create policy "authed all notes" on notes
  for all to authenticated using (true) with check (true);

-- ── Storage: project-images bucket ──────────────────────────────────────────
-- The Tracker renders hero images via their PUBLIC URL (getPublicUrl) inside
-- <img> tags, which carry no auth header. So READ stays public — anyone with
-- the exact image URL can view it (low-sensitivity project thumbnails).
-- Uploads and deletes require a signed-in user.
drop policy if exists "anon upload project images" on storage.objects;
drop policy if exists "anon delete project images" on storage.objects;

-- Keep public read (recreate explicitly).
drop policy if exists "anon read project images" on storage.objects;
create policy "public read project images" on storage.objects
  for select using (bucket_id = 'project-images');

drop policy if exists "authed upload project images" on storage.objects;
create policy "authed upload project images" on storage.objects
  for insert to authenticated with check (bucket_id = 'project-images');

drop policy if exists "authed delete project images" on storage.objects;
create policy "authed delete project images" on storage.objects
  for delete to authenticated using (bucket_id = 'project-images');
