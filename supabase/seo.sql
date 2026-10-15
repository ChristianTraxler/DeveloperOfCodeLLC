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

-- Phase 4: the leads list. One lead can have many reviews (seo_audits.lead_id holds its id as text).
--   status          new, audit_run, report_sent, walkthrough, proposal, won, lost
--   source          facebook, nextdoor, cold_dm, referral, website, other
--   care_plan       true for Website Care clients: a won care plan lead is re-scanned every month
--   report_sent_on  day 0 of the follow-ups (set when the "Send the report" step is ticked)
--   followups       { "<day>": "YYYY-MM-DD" } for the follow-up steps already done
create table if not exists seo_leads (
  id             uuid primary key default gen_random_uuid(),
  business_name  text not null,
  site_url       text,
  city           text,
  service        text,
  contact_name   text,
  email          text,
  phone          text,
  source         text check (source in ('facebook', 'nextdoor', 'cold_dm', 'referral', 'website', 'other')),
  status         text not null default 'new' check (status in ('new', 'audit_run', 'report_sent', 'walkthrough', 'proposal', 'won', 'lost')),
  care_plan      boolean not null default false,
  last_contact   date,
  next_follow_up date,
  report_sent_on date,
  followups      jsonb not null default '{}'::jsonb,
  notes          text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists seo_leads_follow_up on seo_leads (next_follow_up);

-- Phase 4: "Request implementation" from the client report. The client's picks and contact
-- details only; payment happens on Stripe and never touches this table.
create table if not exists seo_requests (
  id         bigserial primary key,
  audit_id   uuid not null references seo_audits (id) on delete cascade,
  lead_id    text,
  offer      text,
  tasks      jsonb not null default '[]'::jsonb,
  name       text not null,
  email      text,
  phone      text,
  message    text,
  emailed    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists seo_requests_audit on seo_requests (audit_id, created_at desc);

alter table seo_audits            enable row level security;
alter table seo_audit_checks      enable row level security;
alter table seo_audit_tasks       enable row level security;
alter table seo_audit_competitors enable row level security;
alter table seo_audit_manual      enable row level security;
alter table seo_places_cache      enable row level security;
alter table seo_leads             enable row level security;
alter table seo_requests          enable row level security;
revoke all on seo_audits, seo_audit_checks, seo_audit_tasks, seo_audit_competitors, seo_audit_manual, seo_places_cache, seo_leads, seo_requests from anon, authenticated;

-- This project does not auto-grant to the API roles (see demos.sql), so the server's
-- service_role gets explicit access, including the id sequences behind the bigserial columns.
grant select, insert, update, delete on seo_audits, seo_audit_checks, seo_audit_tasks, seo_audit_competitors, seo_audit_manual, seo_places_cache, seo_leads, seo_requests to service_role;
grant usage, select on sequence seo_audit_checks_id_seq, seo_audit_tasks_id_seq, seo_audit_competitors_id_seq, seo_audit_manual_id_seq, seo_requests_id_seq to service_role;
