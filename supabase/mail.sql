-- Mail tool for the Developer of Code Admin Hub.
--
-- One linked Gmail account per admin login, private storage for Google tokens, and a small
-- change feed. The mail-push Edge Function writes a row to mail_events whenever Gmail reports
-- a change, and Supabase Realtime pushes that row to the open Mail page within a second or two.
--
-- Safe to run more than once.

create table if not exists public.mail_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  email text not null unique,
  aliases text[] not null default '{}',
  history_id text,
  watch_expires_at timestamptz,
  last_push_at timestamptz,
  last_sync_at timestamptz,
  status text not null default 'active' check (status in ('active', 'needs_reauth')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.mail_accounts is
  'Gmail accounts linked to the admin Mail tool. Written only by the mail-* Edge Functions.';

create table if not exists public.mail_credentials (
  account_id uuid primary key references public.mail_accounts (id) on delete cascade,
  refresh_token_enc text not null,
  access_token_enc text,
  access_expires_at timestamptz,
  scope text,
  updated_at timestamptz not null default now()
);
comment on table public.mail_credentials is
  'Google tokens, encrypted with MAIL_TOKEN_KEY. No policies on purpose: the browser can never read this table.';

create table if not exists public.mail_events (
  id bigint generated always as identity primary key,
  account_id uuid not null references public.mail_accounts (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'changes' check (kind in ('changes', 'resync')),
  thread_ids text[] not null default '{}',
  new_mail jsonb not null default '[]'::jsonb,
  history_id text,
  created_at timestamptz not null default now()
);
comment on table public.mail_events is
  'Change feed for the Mail page. Rows older than 3 days are removed by the mail-cron function.';
create index if not exists mail_events_owner_created_idx on public.mail_events (owner_id, created_at desc);
create index if not exists mail_events_account_idx on public.mail_events (account_id);

create table if not exists public.mail_oauth_states (
  state text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  redirect_to text not null,
  created_at timestamptz not null default now()
);
comment on table public.mail_oauth_states is
  'Short-lived sign-in states for linking Gmail. No policies on purpose.';
create index if not exists mail_oauth_states_owner_idx on public.mail_oauth_states (owner_id);

-- Keep updated_at current
create or replace function public.mail_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists mail_accounts_touch on public.mail_accounts;
create trigger mail_accounts_touch
  before update on public.mail_accounts
  for each row execute function public.mail_touch_updated_at();

drop trigger if exists mail_credentials_touch on public.mail_credentials;
create trigger mail_credentials_touch
  before update on public.mail_credentials
  for each row execute function public.mail_touch_updated_at();

-- Row level security: the signed-in owner can read their account and their change feed.
-- Every write goes through the Edge Functions, which use the project's secret key.
alter table public.mail_accounts enable row level security;
alter table public.mail_credentials enable row level security;
alter table public.mail_events enable row level security;
alter table public.mail_oauth_states enable row level security;

drop policy if exists "mail_accounts: owner can read" on public.mail_accounts;
create policy "mail_accounts: owner can read"
  on public.mail_accounts for select
  to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "mail_events: owner can read" on public.mail_events;
create policy "mail_events: owner can read"
  on public.mail_events for select
  to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on public.mail_credentials from anon, authenticated;
revoke all on public.mail_oauth_states from anon, authenticated;
revoke insert, update, delete on public.mail_accounts from anon, authenticated;
revoke insert, update, delete on public.mail_events from anon, authenticated;

-- Send new mail_events rows over Realtime
do $$
begin
  alter publication supabase_realtime add table public.mail_events;
exception
  when duplicate_object then null;
  when undefined_object then
    raise notice 'The supabase_realtime publication was not found. Turn on Realtime for mail_events in the dashboard.';
end
$$;
