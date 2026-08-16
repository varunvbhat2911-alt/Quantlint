-- Phase 6 (6B/6C): private Supabase Storage bucket for uploaded strategy
-- files, with user-scoped storage RLS policies.
--
-- Object layout (server-controlled, never client-supplied):
--   strategy-files/<auth.uid()>/<audit_id>/<safe_filename>
--
-- The bucket is PRIVATE. The policies below are defense-in-depth for any
-- future user-token storage access: an authenticated user may only touch
-- objects under their OWN <user_id>/ prefix. There are NO public/anon
-- policies and NO blanket authenticated access.
--
-- NOTE ON DEPLOYMENT: this project applies migrations through the Supabase
-- dashboard (no psql/CLI in the dev environment). The bucket itself was
-- also created at runtime through the Storage API (idempotent). Until this
-- migration is applied, storage.objects keeps its default-deny posture for
-- authenticated/anon roles and ALL strategy-file access is server-mediated
-- (service role after RLS-verified audit ownership), so the security
-- invariant holds either way.

insert into storage.buckets (id, name, public)
values ('strategy-files', 'strategy-files', false)
on conflict (id) do update set public = false;

-- Prefix-scoped policies: first path segment must equal the caller's uid.
create policy "strategy_files_select_own_prefix"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'strategy-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "strategy_files_insert_own_prefix"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'strategy-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "strategy_files_update_own_prefix"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'strategy-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'strategy-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "strategy_files_delete_own_prefix"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'strategy-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
