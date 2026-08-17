-- Phase 8: search_path hardening
--
-- The original Phase 8 functions were created without explicit `security invoker`
-- and `set search_path = public` clauses. While Postgres defaults to SECURITY INVOKER,
-- the missing search_path pinning creates a search_path hijack surface if the calling
-- session has a modified search_path. All table references are schema-qualified
-- (public.audits, etc.), which mitigates the immediate risk, but this migration
-- aligns them with the Phase 9 pattern for defense-in-depth.
--
-- This migration redefines the three functions with explicit security attributes.
-- The function bodies are preserved exactly — no logic changes, no signature changes.

-- ============================================================
-- 1. commit_audit_results — atomic result persistence
-- ============================================================
create or replace function public.commit_audit_results(
  p_audit_id uuid,
  p_status text,
  p_progress int,
  p_violations jsonb default '[]'::jsonb,
  p_metrics jsonb default '[]'::jsonb,
  p_recommendations jsonb default '[]'::jsonb,
  p_timeline jsonb default '[]'::jsonb
) returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- Violations
  insert into public.audit_violations (
    audit_id, rule_id, severity, category, title, description, why_it_matters,
    file_name, line, detected_pattern, suggested_fix, code_snippet, fix_snippet,
    status, ai_explanation, sort_order
  )
  select
    p_audit_id,
    v->>'rule_id',
    v->>'severity',
    v->>'category',
    v->>'title',
    v->>'description',
    v->>'why_it_matters',
    nullif(v->>'file_name', ''),
    nullif(v->>'line', '')::int,
    nullif(v->>'detected_pattern', ''),
    nullif(v->>'suggested_fix', ''),
    nullif(v->>'code_snippet', ''),
    nullif(v->>'fix_snippet', ''),
    coalesce(v->>'status', 'open'),
    v->'ai_explanation',
    coalesce(nullif(v->>'sort_order', '')::int, 0)
  from jsonb_array_elements(p_violations) as v;

  -- Metrics
  insert into public.audit_metrics (
    audit_id, group_label, key, label, value, tooltip, sort_order
  )
  select
    p_audit_id,
    v->>'group_label',
    v->>'key',
    v->>'label',
    v->>'value',
    coalesce(v->>'tooltip', ''),
    coalesce(nullif(v->>'sort_order', '')::int, 0)
  from jsonb_array_elements(p_metrics) as v;

  -- Recommendations
  insert into public.audit_recommendations (
    audit_id, priority, title, severity, why, suggested_action,
    related_rule_id, status, sort_order
  )
  select
    p_audit_id,
    nullif(v->>'priority', '')::int,
    v->>'title',
    v->>'severity',
    v->>'why',
    v->>'suggested_action',
    v->>'related_rule_id',
    coalesce(v->>'status', 'open'),
    coalesce(nullif(v->>'sort_order', '')::int, 0)
  from jsonb_array_elements(p_recommendations) as v;

  -- Timeline
  insert into public.audit_timeline (
    audit_id, label, entry_at, sort_order
  )
  select
    p_audit_id,
    v->>'label',
    coalesce(nullif(v->>'entry_at', '')::timestamptz, now()),
    coalesce(nullif(v->>'sort_order', '')::int, 0)
  from jsonb_array_elements(p_timeline) as v;

  -- Final status + progress (atomic with the inserts above)
  update public.audits
  set status = p_status, progress = p_progress
  where id = p_audit_id;
end;
$$;

-- ============================================================
-- 2. recover_stale_audits — stuck-job detection + recovery
-- ============================================================
create or replace function public.recover_stale_audits(
  p_stale_after_minutes int default 10
) returns setof uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  rec record;
begin
  for rec in
    select id from public.audits
    where status = 'running'
      and updated_at < now() - make_interval(mins => p_stale_after_minutes)
  loop
    -- Atomic claim: re-check staleness inside the UPDATE so a recently
    -- active audit is never marked failed.
    update public.audits
    set status = 'failed'
    where id = rec.id
      and status = 'running'
      and updated_at < now() - make_interval(mins => p_stale_after_minutes);

    if found then
      insert into public.audit_timeline (audit_id, label, entry_at, sort_order)
      values (rec.id, 'Audit interrupted — server may have restarted', now(), 999);
      return next rec.id;
    end if;
  end loop;
end;
$$;

-- ============================================================
-- 3. reset_audit_for_retry — atomic failed-audit retry
-- ============================================================
create or replace function public.reset_audit_for_retry(
  p_audit_id uuid
) returns boolean
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- Guard: only failed audits can be retried
  perform 1 from public.audits
  where id = p_audit_id and status = 'failed';
  if not found then
    return false;
  end if;

  -- Delete children while status is still 'failed' (no claim race)
  delete from public.audit_violations where audit_id = p_audit_id;
  delete from public.audit_metrics where audit_id = p_audit_id;
  delete from public.audit_recommendations where audit_id = p_audit_id;
  delete from public.audit_timeline where audit_id = p_audit_id;

  -- Atomically transition to queued (claimAudit can now pick it up)
  update public.audits
  set status = 'queued', progress = 0
  where id = p_audit_id and status = 'failed';

  return found;
end;
$$;
