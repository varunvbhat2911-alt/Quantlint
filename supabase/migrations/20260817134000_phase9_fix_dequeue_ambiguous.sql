-- Phase 9 fix: resolve "column reference ... is ambiguous" in dequeue_audit.
--
-- The RETURNS TABLE clause of dequeue_audit introduces output columns named
-- job_id, audit_id, and attempts. These shadow the audit_job_queue columns of
-- the same names, so bare references like `attempts` inside the function body
-- are ambiguous (SQLSTATE 42702) — observed at runtime as:
--   column reference "attempts" is ambiguous
-- This blocked every dequeue call, so the worker could never claim a job.
--
-- Fix: schema-qualify (alias) every column reference in the SELECT and UPDATE
-- so Postgres resolves them to the table, not the output columns. No schema
-- change, no new objects, no RLS change, no behavior change — only the function
-- body is corrected. Idempotent via `create or replace`.

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
  -- Alias the table so every column reference is unambiguous. The RETURNS TABLE
  -- output columns (job_id/audit_id/attempts) would otherwise shadow these.
  select q.id into rec
  from public.audit_job_queue as q
  where q.status = 'pending'
    and q.visible_at <= now()
    and q.attempts < p_max_attempts
  order by q.visible_at, q.enqueued_at
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

  update public.audit_job_queue as q
  set status = 'running',
      attempts = q.attempts + 1,
      locked_by = p_worker_id,
      locked_at = now()
  where q.id = rec.id;

  return query
  select rec.id as job_id, q.audit_id, q.attempts
  from public.audit_job_queue as q
  where q.id = rec.id;
end;
$$;
