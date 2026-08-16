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
