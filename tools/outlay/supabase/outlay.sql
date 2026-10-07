-- Outlay: expense ledger for the /admin hub
-- Tables, owner-only row level security, and a private receipts bucket.
-- NOT RUN YET. Paste into the Supabase SQL editor when you are ready. Safe to run more than once.
--
-- Every name is prefixed outlay so nothing collides with the tracker, demos or review tables
-- that share this Supabase project: outlay_clients, outlay_subscriptions, outlay_expenses,
-- outlay_set_updated_at(), and the outlay-receipts bucket.
--
-- Access: each row stores the id of the signed-in user who created it (user_id defaults to
-- auth.uid()). Policies only let that user read or write their own rows, and only for the
-- authenticated role, so the anon key alone can never see or change anything.
--
-- Rollback:
--   drop table if exists public.outlay_expenses, public.outlay_subscriptions, public.outlay_clients;
--   drop function if exists public.outlay_set_updated_at();
--   delete from storage.objects where bucket_id = 'outlay-receipts';
--   delete from storage.buckets where id = 'outlay-receipts';

create extension if not exists pgcrypto;

create table if not exists public.outlay_clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.outlay_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  amount_cents integer not null check (amount_cents > 0),
  cadence text not null default 'monthly' check (cadence in ('monthly', 'quarterly', 'annual')),
  next_renewal date not null,
  category text not null default 'software',
  payment_method text,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.outlay_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  spent_on date not null default current_date,
  amount_cents integer not null check (amount_cents > 0),
  vendor text not null check (char_length(vendor) between 1 and 160),
  category text not null default 'software',
  payment_method text,
  notes text,
  is_billable boolean not null default false,
  client_id uuid,
  billing_status text check (billing_status in ('unbilled', 'invoiced', 'reimbursed')),
  subscription_id uuid,
  receipt_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outlay_expenses_billing_status_matches check (
    (is_billable and billing_status is not null) or (not is_billable and billing_status is null)
  ),
  -- Composite keys keep every link inside the same owner's rows.
  constraint outlay_expenses_client_fk foreign key (client_id, user_id)
    references public.outlay_clients (id, user_id) on delete set null (client_id),
  constraint outlay_expenses_subscription_fk foreign key (subscription_id, user_id)
    references public.outlay_subscriptions (id, user_id) on delete set null (subscription_id)
);

create index if not exists outlay_expenses_user_spent_idx on public.outlay_expenses (user_id, spent_on desc);
create index if not exists outlay_expenses_client_idx on public.outlay_expenses (client_id, user_id);
create index if not exists outlay_expenses_subscription_idx on public.outlay_expenses (subscription_id, user_id);
create index if not exists outlay_subscriptions_user_renewal_idx on public.outlay_subscriptions (user_id, next_renewal);
create index if not exists outlay_clients_user_idx on public.outlay_clients (user_id);

create or replace function public.outlay_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists outlay_expenses_set_updated_at on public.outlay_expenses;
create trigger outlay_expenses_set_updated_at before update on public.outlay_expenses
  for each row execute function public.outlay_set_updated_at();
drop trigger if exists outlay_subscriptions_set_updated_at on public.outlay_subscriptions;
create trigger outlay_subscriptions_set_updated_at before update on public.outlay_subscriptions
  for each row execute function public.outlay_set_updated_at();

-- Row level security: on, with no policy for anon, so signed-out requests get nothing.
alter table public.outlay_clients enable row level security;
alter table public.outlay_subscriptions enable row level security;
alter table public.outlay_expenses enable row level security;

do $$
declare t text;
begin
  foreach t in array array['outlay_clients', 'outlay_subscriptions', 'outlay_expenses'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t || '_select_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t || '_insert_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t || '_update_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t || '_delete_own', t);
  end loop;
end $$;

-- Receipts live at outlay-receipts/<user id>/<expense id>/<file>. Private bucket; only that user
-- can read or write files under their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('outlay-receipts', 'outlay-receipts', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do nothing;

drop policy if exists "outlay_receipts_select_own" on storage.objects;
create policy "outlay_receipts_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'outlay-receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "outlay_receipts_insert_own" on storage.objects;
create policy "outlay_receipts_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'outlay-receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "outlay_receipts_update_own" on storage.objects;
create policy "outlay_receipts_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'outlay-receipts' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'outlay-receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "outlay_receipts_delete_own" on storage.objects;
create policy "outlay_receipts_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'outlay-receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
