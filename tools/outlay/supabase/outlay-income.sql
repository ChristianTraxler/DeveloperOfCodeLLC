-- Outlay income: money received, for the gross receipts line of the Schedule C summary.
-- NOT RUN YET. Paste into the Supabase SQL editor after supabase/outlay.sql. Safe to run more than once.
--
-- Cash basis: received_on is the day the money landed, which is the date that decides the tax year.
-- Same owner-only row level security as the other outlay_ tables. Attached invoices or 1099s reuse
-- the private outlay-receipts bucket (path <user id>/income-<income id>/<file>), so no new storage
-- policies are needed.
--
-- Rollback:
--   drop table if exists public.outlay_income;

create table if not exists public.outlay_income (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  received_on date not null default current_date,
  amount_cents integer not null check (amount_cents > 0),
  payer text not null check (char_length(payer) between 1 and 160),
  source text not null default 'invoice' check (source in ('invoice', 'stripe', 'paypal', 'check', 'cash', 'other')),
  client_id uuid,
  notes text,
  document_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outlay_income_client_fk foreign key (client_id, user_id)
    references public.outlay_clients (id, user_id) on delete set null (client_id)
);

create index if not exists outlay_income_user_received_idx on public.outlay_income (user_id, received_on desc);
create index if not exists outlay_income_client_idx on public.outlay_income (client_id, user_id);

drop trigger if exists outlay_income_set_updated_at on public.outlay_income;
create trigger outlay_income_set_updated_at before update on public.outlay_income
  for each row execute function public.outlay_set_updated_at();

alter table public.outlay_income enable row level security;

drop policy if exists outlay_income_select_own on public.outlay_income;
create policy outlay_income_select_own on public.outlay_income for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists outlay_income_insert_own on public.outlay_income;
create policy outlay_income_insert_own on public.outlay_income for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists outlay_income_update_own on public.outlay_income;
create policy outlay_income_update_own on public.outlay_income for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists outlay_income_delete_own on public.outlay_income;
create policy outlay_income_delete_own on public.outlay_income for delete to authenticated using ((select auth.uid()) = user_id);
