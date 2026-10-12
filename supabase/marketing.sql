-- =========================================================
-- Marketing: saved emails, people, settings, sends and results
-- ---------------------------------------------------------
-- Backs /admin/marketing/ (api/marketing.mjs). Run once in
-- Supabase -> SQL Editor. Safe to re-run.
--
-- Nobody but the server touches these tables. RLS is on with no
-- policies, so the anon and authenticated keys see nothing; the
-- API uses the service role key and checks ADMIN_EMAILS itself.
-- =========================================================

-- Settings, people and emails, one row each. data holds the whole object
-- the tool works with, so adding a field to the tool needs no migration.
create table if not exists marketing_docs (
  kind       text not null check (kind in ('settings', 'contact', 'campaign')),
  id         text not null,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (kind, id)
);

-- One row per email going to one person. status:
--   queued   waiting for its send time (scheduled emails; html is kept until it goes out)
--   sent     handed to Resend
--   failed   Resend refused it (error says why)
create table if not exists marketing_sends (
  id          bigserial primary key,
  campaign_id text not null,
  contact_id  text not null,
  email       text not null,
  subject     text not null default '',
  html        text,
  status      text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  send_at     timestamptz not null default now(),
  sent_at     timestamptz,
  resend_id   text unique,
  error       text,
  unique (campaign_id, contact_id)
);
create index if not exists marketing_sends_due on marketing_sends (status, send_at);
create index if not exists marketing_sends_campaign on marketing_sends (campaign_id);

-- What happened after sending, from the Resend webhook.
create table if not exists marketing_events (
  id          bigserial primary key,
  resend_id   text not null,
  campaign_id text,
  contact_id  text,
  type        text not null check (type in ('delivered', 'opened', 'clicked', 'bounced', 'complained')),
  link        text,
  at          timestamptz not null default now()
);
create index if not exists marketing_events_campaign on marketing_events (campaign_id, type);

alter table marketing_docs   enable row level security;
alter table marketing_sends  enable row level security;
alter table marketing_events enable row level security;
revoke all on marketing_docs, marketing_sends, marketing_events from anon, authenticated;
