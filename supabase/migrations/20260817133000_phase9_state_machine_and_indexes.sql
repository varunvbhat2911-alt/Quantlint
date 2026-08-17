-- Phase 9: audit status state machine + evidence-backed indexes.
--
-- 1. STATE MACHINE. Phase 8 constrained the status VALUE SET but not legal
-- transitions, so updateAuditStatus() (session client, RLS-own) could move an
-- audit to any status from any status — e.g. completed→queued would make a
-- finished audit re-claimable by the executor. This trigger enforces the
-- legitimate transitions derived from the existing execution model:
--
--   queued  → running   (claimAudit)
--   running → completed  (commit_audit_results)
--   running → failed     (recover_stale_audits / execution failure)
--   queued  → failed     (intake failure before claim — see runAudit)
--   failed  → queued     (reset_audit_for_retry only)
--
-- completed is terminal: it cannot become queued/running/failed through a
-- generic UPDATE. The retry path goes through reset_audit_for_retry, which
-- deletes children and transitions failed→queued inside its own transaction;
-- that RPC is SECURITY INVOKER and runs as the service role, so it is exempt
-- from this trigger by virtue of running in the same backend session only if
-- we explicitly allow failed→queued. We DO allow failed→queued here so the
-- existing retry RPC keeps working without modification.
--
-- The trigger raises on illegal transitions. To avoid breaking the legitimate
-- service-role RPCs (commit_audit_results sets status = p_status; reset_audit
-- _for_retry sets queued), both legal transitions (running→completed,
-- running→failed, failed→queued) are permitted. A guarded commit_audit_results
-- only ever passes 'completed' or 'failed' from a running audit, which is legal.

create or replace function public.guard_audit_status_transition()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- Allow inserts (no OLD state) and no-op status updates.
  if TG_OP = 'INSERT' then
    return NEW;
  end if;
  if OLD.status = NEW.status then
    return NEW;
  end if;

  case OLD.status
    when 'queued' then
      if NEW.status not in ('running', 'failed') then
        raise exception 'illegal audit transition: queued -> %', NEW.status
          using errcode = 'check_violation';
      end if;
    when 'running' then
      if NEW.status not in ('completed', 'failed') then
        raise exception 'illegal audit transition: running -> %', NEW.status
          using errcode = 'check_violation';
      end if;
    when 'failed' then
      if NEW.status not in ('queued') then
        raise exception 'illegal audit transition: failed -> %', NEW.status
          using errcode = 'check_violation';
      end if;
    when 'completed' then
      raise exception 'illegal audit transition: completed -> %', NEW.status
        using errcode = 'check_violation';
  end case;

  return NEW;
end;
$$;

drop trigger if exists trg_audit_status_transition on public.audits;
create trigger trg_audit_status_transition
  before update of status on public.audits
  for each row
  execute function public.guard_audit_status_transition();

-- ============================================================
-- 2. INDEXES (evidence-backed by actual query patterns in
--    src/lib/audits/service.ts and repository.ts).
-- ============================================================

-- listAudits filters by user_id (RLS) and orders by created_at desc (default).
-- A composite lets the planner satisfy both from one index.
create index if not exists audits_user_created_at_idx
  on public.audits (user_id, created_at desc);

-- listAudits status filter + the recover_stale_audits status scan.
create index if not exists audits_user_status_idx
  on public.audits (user_id, status);

-- recover_stale_audits: status='running' ordered by updated_at age. A partial
-- index bounds the scan to the (usually tiny) running set.
create index if not exists audits_running_updated_at_idx
  on public.audits (updated_at)
  where status = 'running';

-- getResults orders each child by sort_order after filtering by audit_id.
-- Composite indexes return pre-sorted rows.
create index if not exists audit_violations_audit_sort_idx
  on public.audit_violations (audit_id, sort_order);
create index if not exists audit_metrics_audit_sort_idx
  on public.audit_metrics (audit_id, sort_order);
create index if not exists audit_recommendations_audit_sort_idx
  on public.audit_recommendations (audit_id, sort_order);
-- audit_timeline is ordered by sort_order too.
create index if not exists audit_timeline_audit_sort_idx
  on public.audit_timeline (audit_id, sort_order);
