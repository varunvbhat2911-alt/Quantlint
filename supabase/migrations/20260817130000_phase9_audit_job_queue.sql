-- Phase 9: durable, serverless-safe audit execution queue.
--
-- Audits can no longer rely on fire-and-forget work continuing after an HTTP
-- response (incompatible with serverless). Instead, POST /api/audits/[id]/run
-- enqueues a tiny job here and returns 202 immediately; a Supabase Edge
-- Function (or the Node dev worker) drains the queue and calls runAudit().
--
-- Design notes:
--  * The queue is a SEPARATE table from audits on purpose: it tracks delivery
--    metadata (attempts, backoff, dead-lettering) that the audit's own status
--    does not. Audit status remains the authoritative result state; job status
--    tracks queue processing only.
--  * Idempotency: a partial unique index on (audit_id) for active jobs means a
--    duplicate enqueue is a no-op. The existing atomic claim (queued→running
--    in audits) is the second guard: even if a job is processed twice, runAudit
--    no-ops on an already-running/completed/failed audit.
--  * Multi-worker safety: dequeue uses FOR UPDATE SKIP LOCKED so concurrent
--    workers never take the same row.
--  * Poison safety: attempts are capped; a job exceeding max_attempts is moved
--    to 'dead' rather than retried forever.
--  * Visibility timeout: a stale running job (worker died) is requeued by
--    recover_stale_jobs; the atomic audit claim makes a re-run safe.
--  * Payloads contain ONLY the audit id. No source code, no secrets, no user
--    data ever lives in the queue.
--
-- Access: RLS is ENABLED with NO policies → default-deny to anon and
-- authenticated. Only the service-role client (which bypasses RLS) reads/writes
-- the queue, and only after the calling route verified audit ownership through
-- the RLS-scoped session client. This preserves the existing security boundary.

create table if not exists public.audit_job_queue (
  id uuid primary key default gen_random_uuid(),
  -- The audit to execute. FK CASCADE so deleting an audit removes its job.
  audit_id uuid not null references public.audits(id) on delete cascade,
  -- pending = awaiting a worker; running = claimed; completed = acked;
  -- dead = exhausted retries (poison).
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'dead')),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  -- Earliest moment a pending job becomes visible to workers (backoff).
  visible_at timestamptz not null default now(),
  -- Worker correlation for stale-job recovery.
  locked_by uuid,
  locked_at timestamptz,
  last_error text,
  enqueued_at timestamptz not null default now(),
  completed_at timestamptz
);

-- One active job per audit: a duplicate enqueue while a job is pending/running
-- is a no-op (see enqueue_audit). Completed/dead jobs are excluded so an audit
-- can be re-enqueued after a user-triggered retry (reset_audit_for_retry).
create unique index if not exists audit_job_queue_one_active_per_audit
  on public.audit_job_queue (audit_id)
  where status in ('pending', 'running');

-- Worker dequeue scan: pending jobs ready to run, oldest first.
create index if not exists audit_job_queue_dequeue_idx
  on public.audit_job_queue (status, visible_at)
  where status = 'pending';

-- Stale-job recovery scan: running jobs whose lock has aged.
create index if not exists audit_job_queue_stale_idx
  on public.audit_job_queue (locked_at)
  where status = 'running';

alter table public.audit_job_queue enable row level security;
-- No policies are defined: anon and authenticated are default-deny. All access
-- is via the service-role client (bypasses RLS) from server code that has
-- already verified ownership.

-- ============================================================
-- enqueue_audit — atomically enqueue an audit for execution.
--
-- Inserts a pending job unless an active (pending/running) job already exists
-- for this audit, in which case it is a no-op (returns false). Returns true
-- when a new job was created. SECURITY INVOKER, service-role only.
-- ============================================================
create or replace function public.enqueue_audit(p_audit_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.audit_job_queue (audit_id, status, visible_at)
  values (p_audit_id, 'pending', now())
  on conflict (audit_id) where status in ('pending', 'running')
    do nothing;
  return found;
end;
$$;

-- ============================================================
-- dequeue_audit — claim the next ready job for a worker.
--
-- FOR UPDATE SKIP LOCKED makes concurrent workers safe. Atomically transitions
-- the job to 'running' and bumps attempts. Returns the job id + audit id, or
-- NULL when nothing is ready. SECURITY INVOKER, service-role only.
-- ============================================================
create or replace function public.dequeue_audit(
  p_worker_id uuid,
  p_max_attempts integer default 5
)
returns table (job_id uuid, audit_id uuid, attempts integer)
language plpgsql
security invoker
set search_path = public
as $$
declare
  rec record;
begin
  select id into rec
  from public.audit_job_queue
  where status = 'pending'
    and visible_at <= now()
    and attempts < p_max_attempts
  order by visible_at, enqueued_at
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

  update public.audit_job_queue
  set status = 'running',
      attempts = attempts + 1,
      locked_by = p_worker_id,
      locked_at = now()
  where id = rec.id;

  return query
  select rec.id as job_id, q.audit_id, q.attempts
  from public.audit_job_queue q
  where q.id = rec.id;
end;
$$;

-- ============================================================
-- complete_job — acknowledge a finished job (audit completed OR failed).
--
-- The audit's own status was already set by runAudit/commitResults; this only
-- records that the worker is done with the job. SECURITY INVOKER.
-- ============================================================
create or replace function public.complete_audit_job(p_job_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.audit_job_queue
  set status = 'completed',
      completed_at = now(),
      locked_by = null,
      locked_at = null
  where id = p_job_id and status = 'running';
end;
$$;

-- ============================================================
-- fail_audit_job — release a job for retry with backoff, or dead-letter it.
--
-- Called when runAudit threw or the audit could not be processed. If attempts
-- have reached max_attempts, the job is moved to 'dead' (poison) and never
-- retried automatically. Otherwise it returns to 'pending' with a visible_at
-- delay. SECURITY INVOKER, service-role only.
-- ============================================================
create or replace function public.fail_audit_job(
  p_job_id uuid,
  p_error text,
  p_retry_delay_seconds integer default 30
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_attempts integer;
  v_max integer;
begin
  select attempts, max_attempts into v_attempts, v_max
  from public.audit_job_queue
  where id = p_job_id and status = 'running'
  for update;

  if not found then
    return;
  end if;

  if v_attempts >= v_max then
    update public.audit_job_queue
    set status = 'dead',
        last_error = p_error,
        locked_by = null,
        locked_at = null,
        completed_at = now()
    where id = p_job_id;
  else
    update public.audit_job_queue
    set status = 'pending',
        visible_at = now() + make_interval(secs => p_retry_delay_seconds),
        last_error = p_error,
        locked_by = null,
        locked_at = null
    where id = p_job_id;
  end if;
end;
$$;

-- ============================================================
-- recover_stale_jobs — requeue jobs whose worker vanished.
--
-- A 'running' job whose locked_at is older than the threshold is reset to
-- 'pending' (attempts preserved so a repeatedly-stuck job still dead-letters
-- via fail_audit_job's cap). The atomic audit claim (queued→running) makes a
-- re-run safe: if the audit already completed/failed, runAudit no-ops.
-- Returns recovered job ids (for logging). SECURITY INVOKER, service-role only.
-- ============================================================
create or replace function public.recover_stale_jobs(
  p_stale_after_seconds integer default 300
)
returns setof uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  rec record;
begin
  for rec in
    select id from public.audit_job_queue
    where status = 'running'
      and locked_at < now() - make_interval(secs => p_stale_after_seconds)
  loop
    update public.audit_job_queue
    set status = 'pending',
        visible_at = now(),
        locked_by = null,
        locked_at = null,
        last_error = coalesce(last_error, 'worker stalled — requeued')
    where id = rec.id and status = 'running';
    if found then
      return next rec.id;
    end if;
  end loop;
end;
$$;
