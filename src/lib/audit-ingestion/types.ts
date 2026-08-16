/* ── Strategy file ingestion types & limits ────────────────
 *
 * Phase 6: uploaded .py / .zip strategy files are DATA, never executed.
 * Ingestion turns stored bytes into a normalized source string the existing
 * deterministic engine consumes, preserving per-file line mappings so
 * findings never claim incorrect locations.
 * ──────────────────────────────────────────────────────────── */

/* Mirrors the frontend upload limit (src/lib/audit-draft.ts) — enforced
 * server-side on actual byte counts, never on client claims alone. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/* ZIP archive hardening (zip bombs / huge projects). Enforced on the
 * uncompressed sizes BEFORE decompression via the zip entry filter. */
export const MAX_ZIP_ENTRIES = 200;
export const MAX_ZIP_ENTRY_BYTES = 5 * 1024 * 1024;
export const MAX_ZIP_TOTAL_BYTES = 20 * 1024 * 1024;

/* The engine consumes a single source string capped at 10 MB; the assembled
 * multi-file representation must respect the same bound. */
export const MAX_NORMALIZED_CHARS = 10 * 1024 * 1024;

export const MAX_FILENAME_LENGTH = 200;
export const MAX_ENTRY_PATH_LENGTH = 400;
export const MAX_ZIP_PATH_DEPTH = 10;

/* Private Supabase Storage bucket (created by
 * supabase/migrations/20260816190000_create_strategy_files_storage.sql). */
export const STORAGE_BUCKET = "strategy-files";

export const ACCEPTED_EXTENSIONS = [".py", ".zip"] as const;
export type AcceptedExtension = (typeof ACCEPTED_EXTENSIONS)[number];

/* One source file inside the normalized multi-file representation.
 * `startLine` is the 1-based line in the assembled source where the file's
 * ORIGINAL content begins; its content spans `lineCount` lines. A finding at
 * assembled line L inside this segment maps to original line
 * L - startLine + 1 in `path`. */
export type SourceSegment = {
  path: string;
  startLine: number;
  lineCount: number;
};

/* The result of ingesting an uploaded strategy: exactly what the audit
 * engine consumes. `segments` is empty for single-file inputs (paste, .py,
 * single-file .zip) where line numbers already match the original file. */
export type NormalizedStrategy = {
  code: string;
  /* Per-file locations for multi-file ZIPs; empty otherwise. */
  segments: SourceSegment[];
  /* Number of Python files found in the input (≥ 1). */
  fileCount: number;
};

/* Errors carry a safe, user-facing message (timeline/API) — internal details
 * stay in `message` for server logs only. */
export class IngestionError extends Error {
  readonly userMessage: string;
  constructor(userMessage: string, internal?: string) {
    super(internal ?? userMessage);
    this.name = "IngestionError";
    this.userMessage = userMessage;
  }
}
