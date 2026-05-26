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
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;
