-- =========================================================
-- Enable Supabase Realtime for tables the Tracker subscribes to:
--   - notes:  changelog updates live when entries are added (incl. from a
--             git commit).
--   - timers: navbar/floating "currently tracking" pill stays in sync when
--             the timer is started, paused, resumed, or stopped — even from
--             another tab or device.
-- Idempotent; safe to run repeatedly.
-- =========================================================
do $$
declare
  t text;
begin
  foreach t in array array['notes', 'timers'] loop
    -- Skip tables that don't exist in this database — lets the script run
    -- safely against a partially-migrated project (e.g. timers added before
    -- notes, or vice versa).
    if not exists (
      select 1 from pg_tables
      where schemaname = 'public' and tablename = t
    ) then
      raise notice 'Skipping % — table does not exist in public schema', t;
      continue;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
