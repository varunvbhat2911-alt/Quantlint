-- Phase 9: DB-side aggregates replacing unbounded Node-side scans.
--
-- Phase 8's computeListSummary() and getAuditStats() selected ALL of a user's
-- audit rows and ALL of their violation rows into Node and aggregated in JS on
-- every dashboard/list load — O(lifetime data) per request. These two
-- SECURITY INVOKER RPCs compute the same results in Postgres with GROUP BY,
-- returning a handful of rows instead of thousands.
--
-- They run on the RLS-scoped session (publishable-key) client: RLS ensures
-- both audits and audit_violations are restricted to auth.uid()'s rows before
-- the function sees them. No user_id is accepted from the browser.

-- ============================================================
-- audit_status_counts — replacements for getAuditStats()
-- Returns one row per status present for the caller, with the count.
-- The caller sums these into its 5-bucket shape.
-- ============================================================
create or replace function public.audit_status_counts()
returns table (status text, count bigint)
language sql
security invoker
set search_path = public
as $$
  select status::text, count(*)::bigint
  from public.audits
  group by status
$$;

-- ============================================================
-- audit_list_summary — replacement for computeListSummary()
-- Returns a single-row aggregate across the caller's audits+violations:
--   total_audits, total_issues, critical_findings, scored_count, score_sum
-- average_score is computed by the caller as round(score_sum/scored_count,1)
-- (mirroring the JS rounding). Score is computed with the same penalty as the
-- engine: 100 - (critical*15 + warning*5 + info*1), clamped to [0,100].
--
-- Only completed audits contribute to score_sum/scored_count (matches JS).
-- ============================================================
create or replace function public.audit_list_summary()
returns table (
  total_audits bigint,
  total_issues bigint,
  critical_findings bigint,
  scored_count bigint,
  score_sum bigint
)
language sql
security invoker
set search_path = public
as $$
  with per_audit as (
    select
      v.audit_id,
      count(*) filter (where v.severity = 'critical') as crit,
      count(*) filter (where v.severity = 'warning')  as warn,
      count(*) filter (where v.severity = 'info')     as info
    from public.audit_violations v
    group by v.audit_id
  ),
  scored as (
    select
      pa.audit_id,
      greatest(0, least(100, 100 - (pa.crit * 15 + pa.warn * 5 + pa.info * 1))) as score
    from per_audit pa
    join public.audits a on a.id = pa.audit_id
    where a.status = 'completed'
  )
  select
    (select count(*) from public.audits)                                         as total_audits,
    (select coalesce(sum(pa.crit + pa.warn + pa.info), 0) from per_audit pa)     as total_issues,
    (select coalesce(sum(pa.crit), 0) from per_audit pa)                         as critical_findings,
    (select count(*) from scored)                                                 as scored_count,
    (select coalesce(sum(score), 0) from scored)                                  as score_sum
$$;
