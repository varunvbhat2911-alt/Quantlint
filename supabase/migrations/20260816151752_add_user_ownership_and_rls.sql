-- QuantLint Backend Phase 4E + 4G: user ownership and user-scoped RLS.
--
-- Adds user ownership to public.audits and replaces the intentional
-- zero-policy state with authenticated, user-scoped policies. Child tables
-- stay ownership-free; access flows through the parent audit.

-- Guard: this migration assumes an empty audits table (no backfill path).
do $$
begin
  if (select count(*) from public.audits) > 0 then
    raise exception 'public.audits is not empty; backfill user_id before applying this migration';
  end if;
end $$;

-- ── Ownership ────────────────────────────────────────────────
alter table public.audits
  add column user_id uuid not null references auth.users (id) on delete cascade;

create index audits_user_id_idx on public.audits (user_id);

-- ── RLS policies: public.audits (owner = auth.uid()) ─────────
create policy "audits_select_own"
  on public.audits for select
  to authenticated
  using (user_id = auth.uid());

create policy "audits_insert_own"
  on public.audits for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "audits_update_own"
  on public.audits for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "audits_delete_own"
  on public.audits for delete
  to authenticated
  using (user_id = auth.uid());

-- ── RLS policies: child tables (ownership via parent audit) ──
-- Users read children of their own audits. Writes to child tables are
-- performed server-side by the audit executor (service role); no direct
-- authenticated write path exists, so no insert/update/delete policies
-- are granted on children.

create policy "audit_violations_select_own"
  on public.audit_violations for select
  to authenticated
  using (
    exists (
      select 1 from public.audits a
      where a.id = audit_violations.audit_id and a.user_id = auth.uid()
    )
  );

create policy "audit_metrics_select_own"
  on public.audit_metrics for select
  to authenticated
  using (
    exists (
      select 1 from public.audits a
      where a.id = audit_metrics.audit_id and a.user_id = auth.uid()
    )
  );

create policy "audit_recommendations_select_own"
  on public.audit_recommendations for select
  to authenticated
  using (
    exists (
      select 1 from public.audits a
      where a.id = audit_recommendations.audit_id and a.user_id = auth.uid()
    )
  );

create policy "audit_timeline_select_own"
  on public.audit_timeline for select
  to authenticated
  using (
    exists (
      select 1 from public.audits a
      where a.id = audit_timeline.audit_id and a.user_id = auth.uid()
    )
  );

comment on column public.audits.user_id is
  'Owning authenticated user (auth.users.id); enforced by RLS, set server-side only.';
