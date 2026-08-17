-- Phase 9: scheduled stale-audit + stale-job recovery.
--
-- Phase 8 introduced recover_stale_audits() but never scheduled it; the only
-- caller was an opportunistic, cross-tenant sweep inside the user's run request
-- (removed in Phase 9). This migration wires periodic recovery to pg_cron so
-- stuck audits and stalled worker jobs are recovered WITHOUT any user request
-- triggering global work.
--
-- Two schedules:
--   1. recover_stale_audits(10) every 2 minutes — audits stuck in 'running'
--      past the 10-minute heartbeat threshold are failed with a timeline entry.
--   2. recover_stale_jobs(300) every 2 minutes — queue jobs whose worker
--      vanished (locked_at older than 5 min) are requeued for another worker.
--
-- pg_cron is a Supabase-native extension (enabled from the dashboard →
-- Database → Extensions). If pg_cron is unavailable, the equivalent is a
-- Supabase Scheduled Function (Dashboard → Edge Functions → schedule) that
-- calls these two RPCs over the service-role key; the SQL below is guarded so
-- that absence of pg_cron does not break migration application.
--
-- Both recovery functions are concurrency-safe (atomic UPDATE ... WHERE
-- status='running') and SECURITY INVOKER; they must run as the service role
-- (pg_cron runs as the migration owner / postgres), which is intended here.

create extension if not exists pg_cron with schema extensions;

-- Schedule audit recovery (idempotent: job names are re-created if missing).
do $$
begin
  -- Remove any prior version of this job to keep the schedule authoritative.
  perform cron.unschedule('phase9_recover_stale_audits');
exception
  when others then null;
end $$;

do $$
begin
  perform cron.schedule(
    'phase9_recover_stale_audits',
    '*/2 * * * *',
    $cron$ select public.recover_stale_audits(10); $cron$
  );
exception
  when others then
    raise notice 'pg_cron schedule for audits skipped: %', sqlerrm;
end $$;

-- Schedule queue stalled-job recovery.
do $$
begin
  perform cron.unschedule('phase9_recover_stale_jobs');
exception
  when others then null;
end $$;

do $$
begin
  perform cron.schedule(
    'phase9_recover_stale_jobs',
    '*/2 * * * *',
    $cron$ select public.recover_stale_jobs(300); $cron$
  );
exception
  when others then
    raise notice 'pg_cron schedule for jobs skipped: %', sqlerrm;
end $$;
