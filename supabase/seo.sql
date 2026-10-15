-- =========================================================
-- SEO Review: local SEO audits, their checks, and later phases
-- ---------------------------------------------------------
-- Backs /admin/seo/ (api/seo.mjs). Run once in
-- Supabase -> SQL Editor. Safe to re-run.
--
-- Same lock as Marketing: RLS is on with no policies, so the anon and
-- authenticated keys see nothing. Only api/seo.mjs reads and writes,
-- with the service role key, after checking the signed-in admin's
-- email against ADMIN_EMAILS. The future client share page will go
-- through the same API and only ever return one reviewed audit by
-- its share_token, never these tables directly.
--
-- Phase 1 writes seo_audits and seo_audit_checks. The other three
-- tables are created now so the data model is settled; they fill in
-- during Phases 2 to 4.
-- =========================================================

-- One row per review of one site.
--   status          running, complete, failed
--   category_scores per category: { pass, warn, fail, skipped, notRun, score }
--                   (score stays null until Phase 2 scoring)
--   lead_id         free text for now; Phase 4 links it to the leads list
create table if not exists seo_audits (
  id              uuid primary key default gen_random_uuid(),
  lead_id         text,
  site_url        text not null,
  final_url       text,
  business_name   text not null,
  city            text not null,
  service         text not null,
  overall_score   integer check (overall_score between 0 and 100),
  category_scores jsonb not null default '{}'::jsonb,
  status          text not null default 'running' check (status in ('running', 'complete', 'failed')),
  error           text,
  notes           jsonb not null default '{}'::jsonb,
  duration_ms     integer,
  created_at      timestamptz not null default now(),
  reviewed_at     timestamptz,
  share_token     text unique
);
create index if not exists seo_audits_created on seo_audits (created_at desc);
create index if not exists seo_audits_site on seo_audits (site_url, created_at desc);
create index if not exists seo_audits_lead on seo_audits (lead_id);

-- One row per check in a review. score: 1 pass, 0.5 warn, 0 fail, null skipped.
create table if not exists seo_audit_checks (
  id          bigserial primary key,
  audit_id    uuid not null references seo_audits (id) on delete cascade,
  category    text not null,
  check_key   text not null,
  status      text not null check (status in ('pass', 'warn', 'fail', 'skipped')),
  score       numeric(3, 2),
  summary     text,
  explanation text,
  details     jsonb not null default '{}'::jsonb,
  unique (audit_id, check_key)
);
create index if not exists seo_audit_checks_key on seo_audit_checks (check_key, audit_id);

-- Phase 2: the Next Steps list. Every failed or warned check becomes a task.
create table if not exists seo_audit_tasks (
  id             bigserial primary key,
  audit_id       uuid not null references seo_audits (id) on delete cascade,
  check_id       bigint references seo_audit_checks (id) on delete cascade,
  title          text not null,
  impact         text check (impact in ('high', 'medium', 'low')),
  effort         text check (effort in ('small', 'medium', 'large')),
  service_tag    text,
  priority_order integer,
  done           boolean not null default false
);
create index if not exists seo_audit_tasks_audit on seo_audit_tasks (audit_id, priority_order);

-- Phase 3: the top 3 local results, scored on the same checks.
create table if not exists seo_audit_competitors (
  id       bigserial primary key,
  audit_id uuid not null references seo_audits (id) on delete cascade,
  name     text not null,
  site_url text,
  place_id text,
  scores   jsonb not null default '{}'::jsonb
);
create index if not exists seo_audit_competitors_audit on seo_audit_competitors (audit_id);

-- Phase 3: rank for "[service] [city]", entered by hand in v1.
create table if not exists seo_audit_manual (
  id            bigserial primary key,
  audit_id      uuid not null references seo_audits (id) on delete cascade,
  keyword       text not null,
  rank_position integer check (rank_position > 0),
  checked_on    date not null default current_date
);
create index if not exists seo_audit_manual_audit on seo_audit_manual (audit_id);

-- Phase 3 additions to the competitor rows.
--   position  place in Google's map results for "[service] in [city]" (null when added by hand)
--   status    pending until its checks have run, then complete or failed
--   scores    { place: Google facts, statuses: { check_key: status }, overall, ranAt }
alter table seo_audit_competitors add column if not exists position   integer;
alter table seo_audit_competitors add column if not exists status     text not null default 'pending';
alter table seo_audit_competitors add column if not exists error      text;
alter table seo_audit_competitors add column if not exists created_at timestamptz not null default now();
do $$ begin
  alter table seo_audit_competitors add constraint seo_audit_competitors_status check (status in ('pending', 'complete', 'failed'));
exception when duplicate_object then null; end $$;

-- Phase 3: Google Places answers, so repeat reviews do not pay for the same search twice.
--   cache_key  "search:<query>:<size>" (a list of places) or "place:<place_id>" (one place)
create table if not exists seo_places_cache (
  cache_key  text primary key,
  data       jsonb not null,
  fetched_at timestamptz not null default now()
);

alter table seo_audits            enable row level security;
alter table seo_audit_checks      enable row level security;
alter table seo_audit_tasks       enable row level security;
alter table seo_audit_competitors enable row level security;
alter table seo_audit_manual      enable row level security;
alter table seo_places_cache      enable row level security;
revoke all on seo_audits, seo_audit_checks, seo_audit_tasks, seo_audit_competitors, seo_audit_manual, seo_places_cache from anon, authenticated;
