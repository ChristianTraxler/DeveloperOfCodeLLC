-- Run this once in the SQL editor, after the mail-cron function is deployed.
-- Replace the two placeholder values first.
--
-- It stores your project URL and the cron secret in Vault, then schedules one job that calls
-- mail-cron every 6 hours. Each run renews the Gmail watch (Google stops sending updates if it
-- is not renewed within 7 days), catches up on anything a push might have missed, and clears
-- old rows from the change feed.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('https://YOUR-PROJECT-REF.supabase.co', 'mail_project_url');
select vault.create_secret('PASTE-THE-SAME-VALUE-YOU-USED-FOR-MAIL_CRON_SECRET', 'mail_cron_secret');

select cron.schedule(
  'mail-watch-renew',
  '17 */6 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'mail_project_url') || '/functions/v1/mail-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'mail_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- To check it later:
--   select * from cron.job where jobname = 'mail-watch-renew';
--   select * from cron.job_run_details order by start_time desc limit 5;
-- To remove it:
--   select cron.unschedule('mail-watch-renew');
