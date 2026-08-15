-- QuantLint Backend Phase 1B + 1C: supporting audit tables and RLS foundation.
--
-- Column design mirrors the frontend result model in
-- src/lib/mock-data/audit-result.ts (Violation, MetricGroup, Recommendation,
-- TimelineEntry, AIExplanation) so the future real pipeline can persist what
-- the result UI already renders. Only job-scoped fields live here — the audit
-- header itself stays in public.audits.

-- ============================================================
-- 1B: public.audit_violations  (frontend: Violation)
-- ============================================================
create table public.audit_violations (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.audits (id) on delete cascade,

  rule_id text not null,
  severity text not null
    check (severity in ('critical', 'warning', 'info')),
  category text not null
    check (category in ('bias', 'risk', 'execution', 'data', 'performance', 'structure')),
  title text not null,
  description text not null,
  why_it_matters text not null,
  file_name text,
  line integer,
  detected_pattern text,
  suggested_fix text,
  code_snippet text,
  fix_snippet text,
  status text not null default 'open'
    check (status in ('open', 'resolved', 'ignored')),

  -- AIExplanation object (ruleId, finding, explanation, whyItMatters,
  -- suggestedFix, confidence, relatedViolationId) when applicable.
  -- Deliberately jsonb until the AI phase defines its own table.
  ai_explanation jsonb,

  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create index audit_violations_audit_id_idx on public.audit_violations (audit_id);

-- ============================================================
-- 1B: public.audit_metrics  (frontend: MetricGroup.metrics[])
-- -- one row per metric, group_label keeps the MetricGroup concept
-- ============================================================
create table public.audit_metrics (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.audits (id) on delete cascade,

  group_label text not null,
  key text not null,
  label text not null,
  -- display value as produced by the pipeline (e.g. "18.2%"), hence text
  value text not null,
  tooltip text not null default '',

  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create index audit_metrics_audit_id_idx on public.audit_metrics (audit_id);

-- ============================================================
-- 1B: public.audit_recommendations  (frontend: Recommendation)
-- ============================================================
create table public.audit_recommendations (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.audits (id) on delete cascade,

  priority integer not null,
  title text not null,
  severity text not null
    check (severity in ('critical', 'warning', 'info')),
  why text not null,
  suggested_action text not null,
  related_rule_id text not null,
  status text not null default 'open'
    check (status in ('open', 'resolved', 'ignored')),

  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create index audit_recommendations_audit_id_idx on public.audit_recommendations (audit_id);

-- ============================================================
-- 1B: public.audit_timeline  (frontend: TimelineEntry)
-- ============================================================
create table public.audit_timeline (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.audits (id) on delete cascade,

  label text not null,
  entry_at timestamptz not null default now(),

  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create index audit_timeline_audit_id_idx on public.audit_timeline (audit_id);

-- ============================================================
-- 1C: Row Level Security foundation
--
-- RLS is enabled on ALL five audit tables with ZERO policies.
-- This is default-deny: anon/authenticated API roles can neither read nor
-- write until policies exist. Policies (user-scoped) will be added together
-- with the authentication phase — intentionally none are created now, and no
-- public/anon access policy is created for testing.
-- The service role bypasses RLS for server-side operations.
-- ============================================================
alter table public.audits enable row level security;
alter table public.audit_violations enable row level security;
alter table public.audit_metrics enable row level security;
alter table public.audit_recommendations enable row level security;
alter table public.audit_timeline enable row level security;

comment on table public.audit_violations is
  'Findings for one audit run; columns mirror the frontend Violation type.';
comment on table public.audit_metrics is
  'Display metrics for one audit run; one row per metric, grouped by group_label.';
comment on table public.audit_recommendations is
  'Prioritized recommendations for one audit run; mirrors the frontend Recommendation type.';
comment on table public.audit_timeline is
  'Pipeline event log for one audit run; mirrors the frontend TimelineEntry type.';
