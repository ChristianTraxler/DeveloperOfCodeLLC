-- =========================================================
-- Demo thumbnails: two nullable columns and a public image bucket
-- ---------------------------------------------------------
-- thumb_url  automatic screenshot of the live demo (api/demos.mjs, action=thumb)
-- cover_url  custom cover image set from Edit; wins over thumb_url on the card
-- Run once in Supabase -> SQL Editor, before or after deploying. Safe to re-run.
-- Nothing existing is changed or dropped.
-- =========================================================

alter table demos add column if not exists thumb_url text;
alter table demos add column if not exists cover_url text;

-- Public bucket: the images are shown on the admin cards, so they carry no secrets.
-- Screenshots are written by the server with the service role key. Covers go in
-- through signed upload URLs issued by api/demos.mjs, so no storage.objects policies
-- are added for browser roles.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('demo-thumbs', 'demo-thumbs', true, 5242880,
        array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
