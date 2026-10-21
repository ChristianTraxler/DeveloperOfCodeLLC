-- Content Queue: posts and businesses for /admin/content-queue/, saved to the signed-in account
-- so they sync across devices. Plus a bucket for uploaded post images.
-- Paste into the Supabase SQL editor. Safe to run more than once.
--
-- Names are prefixed content_ so nothing collides with the other tools in this project:
-- content_accounts, content_posts, content_set_updated_at(), and the content-images bucket.
--
-- Access: each row stores the id of the user who created it (user_id defaults to auth.uid()).
-- Policies only let that user read or write their own rows, and only for the authenticated
-- role. This project does not auto-grant the standard roles, so the grants below are needed.
--
-- Images: the bucket is public so a post's image link works anywhere (the preview, a scheduler).
-- File names are random, and only the owner can add, change or remove files in their folder.
--
-- Rollback:
--   drop table if exists public.content_posts, public.content_accounts;
--   drop function if exists public.content_set_updated_at();
--   delete from storage.objects where bucket_id = 'content-images';
--   delete from storage.buckets where id = 'content-images';

create extension if not exists pgcrypto;

-- Who a post is for. `key` is the id the app uses ('doc', 'rwc', or one made from the name).
create table if not exists public.content_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null check (char_length(key) between 1 and 64),
  name text not null check (char_length(name) between 1 and 120),
  handle text not null default '',
  initials text not null default '',
  about text not null default '',
  site text not null default '',
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, key)
);

-- account holds a business key with no foreign key on purpose: removing a business keeps its posts.
create table if not exists public.content_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default '',
  notes text not null default '',
  body text not null default '',
  platform text check (platform in ('facebook', 'instagram', 'linkedin', 'x', 'gbp', 'blog', 'email')),
  account text not null default 'doc',
  image_url text not null default '',
  scheduled_at timestamptz,
  status text not null default 'idea' check (status in ('idea', 'drafting', 'scheduled', 'posted', 'skipped')),
  tags text[] not null default '{}',
  live_url text not null default '',
  posted_at timestamptz,
  promo jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_posts_user_status_idx on public.content_posts (user_id, status);
create index if not exists content_posts_user_scheduled_idx on public.content_posts (user_id, scheduled_at);
create index if not exists content_accounts_user_idx on public.content_accounts (user_id, sort);

create or replace function public.content_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists content_posts_set_updated_at on public.content_posts;
create trigger content_posts_set_updated_at before update on public.content_posts
  for each row execute function public.content_set_updated_at();

-- Row level security: on, with no policy for anon, so signed-out requests get nothing.
alter table public.content_accounts enable row level security;
alter table public.content_posts enable row level security;

do $$
declare t text;
begin
  foreach t in array array['content_accounts', 'content_posts'] loop
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

grant select, insert, update, delete on public.content_accounts, public.content_posts to authenticated, service_role;

-- Live updates: changes made on one device show up on the others without a reload.
do $$
declare t text;
begin
  foreach t in array array['content_accounts', 'content_posts'] loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Uploaded images live at content-images/<user id>/<post id>/<file>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('content-images', 'content-images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

drop policy if exists "content_images_insert_own" on storage.objects;
create policy "content_images_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'content-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "content_images_update_own" on storage.objects;
create policy "content_images_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'content-images' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'content-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "content_images_delete_own" on storage.objects;
create policy "content_images_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'content-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- Select on the owner's own files (the bucket is public, so this is only for listing them).
drop policy if exists "content_images_select_own" on storage.objects;
create policy "content_images_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'content-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
