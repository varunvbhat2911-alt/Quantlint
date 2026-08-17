/* ── Strategy file storage (server-only) ───────────────────
 *
 * Private bucket `strategy-files`, object layout:
 *   <user_id>/<audit_id>/<safe_filename>
 *
 * The path is SERVER-CONTROLLED and derived from server-verified values —
 * the browser never supplies a path. Because sanitizeFileName() is
 * deterministic, the path is a pure function of (user_id, audit_id,
 * file_name): every access (ingestion, delete) re-derives it, so no extra
 * bookkeeping column exists or is needed.
 *
 * All operations run through the service-role client AFTER the calling route
 * verified ownership through the RLS-scoped audits table. storage.objects is
 * additionally guarded by user-prefix RLS policies (applied remotely by
 * supabase/migrations/20260816190000_create_strategy_files_storage.sql).
 * ──────────────────────────────────────────────────────────── */

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeFileName } from "./validation";
import { IngestionError, STORAGE_BUCKET } from "./types";

/* Minimal storage surface — satisfied by supabase-js clients and test fakes
 * alike, keeping unit tests off real Storage. */
export type StrategyStorageClient = {
  storage: {
    from(bucket: string): {
      upload(
        path: string,
        body: Uint8Array,
        options?: { contentType?: string; upsert?: boolean },
      ): Promise<{ data: unknown; error: { message: string } | null }>;
      download(
        path: string,
      ): Promise<{ data: Blob | Uint8Array | null; error: { message: string } | null }>;
      remove(
        paths: string[],
      ): Promise<{ data: unknown; error: { message: string } | null }>;
      list(
        prefix?: string,
        options?: { limit?: number; offset?: number; search?: string },
      ): Promise<{ data: { name: string }[] | null; error: { message: string } | null }>;
    };
  };
};

export function createStrategyStorageClient(): StrategyStorageClient {
  return createAdminClient();
}

/* The authoritative object path. Inputs must be server-verified (session
 * user id, database audit id); the filename is re-sanitized defensively. */
export function strategyObjectPath(
  userId: string,
  auditId: string,
  fileName: string,
): string {
  return `${userId}/${auditId}/${sanitizeFileName(fileName)}`;
}

/* Audit rows that own an uploaded file (upload input + known filename). */
export function strategyPathForAudit(audit: {
  input_type: string;
  file_name: string | null;
  user_id: string;
  id: string;
}): string | null {
  if (audit.input_type !== "upload" || !audit.file_name) return null;
  return strategyObjectPath(audit.user_id, audit.id, audit.file_name);
}

/* Files are inert data; octet-stream avoids any content sniffing. */
const UPLOAD_CONTENT_TYPE = "application/octet-stream";

export async function uploadStrategyFile(
  client: StrategyStorageClient,
  args: { userId: string; auditId: string; fileName: string; bytes: Uint8Array },
): Promise<string> {
  const path = strategyObjectPath(
    args.userId,
    args.auditId,
    args.fileName,
  );
  const { error } = await client.storage
    .from(STORAGE_BUCKET)
    .upload(path, args.bytes, {
      contentType: UPLOAD_CONTENT_TYPE,
      upsert: false,
    });
  if (error) {
    throw new IngestionError(
      "Failed to store the strategy file.",
      `storage upload failed at ${path}: ${error.message}`,
    );
  }
  return path;
}

export async function downloadStrategyFile(
  client: StrategyStorageClient,
  path: string,
): Promise<Uint8Array> {
  const { data, error } = await client.storage.from(STORAGE_BUCKET).download(path);
  if (error || !data) {
    throw new IngestionError(
      "The uploaded strategy file could not be read.",
      `storage download failed at ${path}: ${error?.message ?? "missing"}`,
    );
  }
  if (data instanceof Uint8Array) return data;
  return new Uint8Array(await data.arrayBuffer());
}

/* Best-effort removal for audit deletion. Missing objects are fine; real
 * failures are reported so callers can log (the audit row is already gone
 * by then — an orphaned object is inert because its path is no longer
 * derivable from any row). */
export async function deleteStrategyFile(
  client: StrategyStorageClient,
  path: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await client.storage.from(STORAGE_BUCKET).remove([path]);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/* ── User-prefix cleanup (account deletion) ─────────────────
 *
 * When a user is deleted, auth.users CASCADE removes their audits + children,
 * but storage objects are NOT cascaded (no FK possible). This sweeps the
 * user's prefix in the strategy-files bucket and removes every object under
 * <userId>/. Idempotent: a second call finds nothing and succeeds. Best-effort:
 * a failure is reported but does not block account deletion (the DB rows are
 * already gone; orphaned objects are inert and can be re-swept later).
 *
 * Paths are derived from the trusted user id only — never from client input —
 * so this can never touch another user's files. */
export type StorageSweepResult = {
  removed: number;
  failed: number;
  errors: string[];
};

export async function deleteUserStorage(
  client: StrategyStorageClient,
  userId: string,
): Promise<StorageSweepResult> {
  const bucket = client.storage.from(STORAGE_BUCKET);
  const result: StorageSweepResult = { removed: 0, failed: 0, errors: [] };
  // Paginate the user's prefix. supabase-js list() returns up to 1000 by
  // default; we loop with offset until an empty page is returned.
  let offset = 0;
  const pageSize = 1000;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const listRes = await bucket.list(userId, { limit: pageSize, offset });
    const files = (listRes as { data?: { name: string }[]; error?: { message: string } | null }).data ?? [];
    const err = (listRes as { error?: { message: string } | null }).error;
    if (err) {
      result.failed += 1;
      result.errors.push(`list failed: ${err.message}`);
      break;
    }
    if (files.length === 0) break;
    // Objects live at <userId>/<auditId>/<file>; list(userId) returns the
    // auditId-level "folders". Recurse one level to get the file names, then
    // remove by full path. (Storage list is shallow.)
    const pathsToRemove: string[] = [];
    for (const folder of files) {
      const inner = await bucket.list(`${userId}/${folder.name}`, {
        limit: pageSize,
        offset: 0,
      });
      const innerErr = (inner as { error?: { message: string } | null }).error;
      if (innerErr) {
        result.failed += 1;
        result.errors.push(`list ${userId}/${folder.name} failed: ${innerErr.message}`);
        continue;
      }
      const innerFiles = (inner as { data?: { name: string }[] }).data ?? [];
      for (const f of innerFiles) {
        pathsToRemove.push(`${userId}/${folder.name}/${f.name}`);
      }
    }
    if (pathsToRemove.length > 0) {
      const rm = await bucket.remove(pathsToRemove);
      const rmErr = (rm as { error?: { message: string } | null }).error;
      if (rmErr) {
        result.failed += pathsToRemove.length;
        result.errors.push(`remove failed: ${rmErr.message}`);
      } else {
        result.removed += pathsToRemove.length;
      }
    }
    if (files.length < pageSize) break;
    offset += pageSize;
  }
  return result;
}
