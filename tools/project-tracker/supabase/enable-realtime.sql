-- =========================================================
-- Enable Supabase Realtime for the notes table, so the Tracker's
-- changelog updates live (no page refresh) when entries are added —
-- including from a git commit. Idempotent; safe to run repeatedly.
-- =========================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notes'
  ) then
    alter publication supabase_realtime add table notes;
  end if;
end $$;
