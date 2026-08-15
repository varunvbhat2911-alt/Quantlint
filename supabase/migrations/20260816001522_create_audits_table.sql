-- QuantLint Backend Phase 1A: core audit job table.
--
-- Mirrors the frontend AuditDraft (src/lib/audit-draft.ts) and leaves room for
-- the real audit pipeline (status/progress lifecycle). A later migration will
-- add `user_id uuid references auth.users(id)` once authentication is
-- implemented; nothing in this schema precludes it.

create table public.audits (
  id uuid primary key default gen_random_uuid(),

  -- Strategy input (AuditDraft fields)
  strategy_name text not null,
  input_type text not null
    check (input_type in ('upload', 'paste')),
  -- null when input_type = 'paste'
  file_name text,
  framework text not null default 'auto'
    check (framework in ('auto', 'vectorbt', 'backtrader', 'zipline', 'pandas')),
  analysis_depth text not null default 'standard'
    check (analysis_depth in ('standard', 'deep', 'fast')),
  -- subset of the frontend RULE_CATEGORIES selection; empty array allowed
  rule_categories text[] not null default '{}'::text[]
    check (
      rule_categories <@ array[
        'Look-ahead Bias',
        'Data Leakage',
        'Survivorship Bias',
        'Risk Management',
        'Position Sizing',
        'Performance Metrics',
        'Execution Logic',
        'Transaction Costs',
        'Portfolio Logic'
      ]
    ),
  -- strategy source when input_type = 'paste'; empty string when uploaded
  code text not null default '',

  -- Audit lifecycle
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed')),
  progress smallint not null default 0
    check (progress between 0 and 100),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Queue polling / "in-progress" filters and newest-first history listings
create index audits_status_idx on public.audits (status);
create index audits_created_at_idx on public.audits (created_at desc);

-- updated_at maintenance via the Supabase-packed extension
create extension if not exists moddatetime with schema extensions;

create trigger handle_updated_at
  before update on public.audits
  for each row execute function extensions.moddatetime(updated_at);

-- Row Level Security: enabled with no policies. Default-deny for anon and
-- authenticated roles; the service role bypasses RLS. Policies will be added
-- together with authentication — deliberately none are created now.
alter table public.audits enable row level security;

comment on table public.audits is
  'QuantLint audit jobs: one row per strategy audit run (Phase 1A, pre-authentication).';
comment on column public.audits.status is
  'Audit lifecycle: queued -> running -> completed | failed.';
comment on column public.audits.progress is
  'Pipeline completion percentage, 0-100.';
