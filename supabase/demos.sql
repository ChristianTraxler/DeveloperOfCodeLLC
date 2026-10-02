-- =========================================================
-- Demos: table, access rules, and upload bucket
-- ---------------------------------------------------------
-- Backs /admin/demos/ (uploads) and demos.developerofcode.com (landing page
-- and routing). Run once in Supabase -> SQL Editor. Safe to re-run.
--
-- Who can do what:
--   anon           read live, visible, non-private demos only (landing page);
--                  look up one slug at a time via demo_route() (routing; a private demo
--                  only resolves with its access_key)
--   authenticated  same columns as anon on every row (the admin page lists through the API)
--   service_role   everything (api/demos.mjs does all writes)
-- =========================================================

create table if not exists demos (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  name              text not null default '',
  description       text not null default '',
  concept           boolean not null default true,   -- shows a "Concept" tag on the card
  kind              text check (kind in ('source', 'built')),
  -- status: is it public? build_state: how did the latest upload go? Kept apart so
  -- replacing a live demo leaves the old version up until the new build is READY.
  status            text not null default 'draft' check (status in ('draft', 'live')),
  build_state       text not null default 'idle'
                    check (build_state in ('idle', 'building', 'ready', 'failed')),
  hidden            boolean not null default false,  -- offline: no card, link 404s
  private           boolean not null default false,  -- no card, link needs ?key=<access_key>
  access_key        text,                           -- set by api/demos.mjs; New key replaces it
  sort_order        integer not null default 0,
  zip_path          text,                           -- latest upload, reused by Rebuild
  vercel_project_id text,
  deployment_id     text,
  production_url    text,                           -- what the demos site rewrites to
  inspector_url     text,                           -- Vercel build log for the latest attempt
  error             text,
  warnings          jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Added after the first release; a no-op on fresh installs.
alter table demos add column if not exists private boolean not null default false;
alter table demos add column if not exists access_key text;
-- Demos made private before keys existed get one, so they have a link to share.
update demos set access_key = substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
  where private and access_key is null;

create or replace function demos_touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists demos_updated_at on demos;
create trigger demos_updated_at before update on demos
  for each row execute function demos_touch_updated_at();

-- ── Row Level Security ──────────────────────────────────────────────────────
alter table demos enable row level security;

drop policy if exists "public reads live demos" on demos;
create policy "public reads live demos" on demos
  for select to anon
  using (status = 'live' and hidden = false and private = false);

drop policy if exists "admin reads all demos" on demos;
create policy "admin reads all demos" on demos
  for select to authenticated
  using (true);

-- Routing for one slug. A private demo resolves only with its current access key, so
-- anon can open a link it was given but can neither list private demos nor read keys.
-- Security definer because anon has no row access to private demos.
drop function if exists demo_route(text);
create or replace function demo_route(p_slug text, p_key text default null) returns text
language sql stable security definer set search_path = public as $$
  select production_url from demos
  where slug = p_slug and status = 'live' and hidden = false
    and (private = false or (access_key is not null and access_key = p_key))
$$;
revoke all on function demo_route(text, text) from public;
grant execute on function demo_route(text, text) to anon, authenticated, service_role;

-- No insert/update/delete policies: browser roles cannot write. The API uses
-- service_role, which bypasses RLS.

-- ── Table privileges ────────────────────────────────────────────────────────
-- This project does not auto-grant to anon, so the landing page needs an
-- explicit read grant. Writes are revoked from browser roles as a second lock.
-- Column grants: browser roles get the landing page's fields only, never access_key.
-- (Any signed-up Supabase user is "authenticated"; the admin page reads through the API.)
revoke select on demos from anon, authenticated;
grant select (slug, name, description, concept, status, hidden, private, sort_order, created_at)
  on demos to anon, authenticated;
revoke insert, update, delete on demos from anon, authenticated;
grant select, insert, update, delete on demos to service_role;

-- ── Storage: private bucket for uploaded zips ───────────────────────────────
-- Uploads only happen through signed upload URLs issued by api/demos.mjs, so
-- no storage.objects policies are added for browser roles.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('demo-uploads', 'demo-uploads', false, 52428800,
        array['application/zip', 'application/x-zip-compressed', 'application/octet-stream'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
