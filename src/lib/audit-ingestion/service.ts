/* ── Ingestion service ─────────────────────────────────────
 *
 * Orchestrates the uploaded-file lifecycle's ingestion half:
 * storage download → content re-validation → decode/extract → normalized
 * strategy source for the engine. The upload half (validate → create audit
 * → store → persist) lives in POST /api/audits.
 * ──────────────────────────────────────────────────────────── */

import { IngestionError, type AcceptedExtension, type NormalizedStrategy } from "./types";
import { extensionOf, validateContentMatches } from "./validation";
import { decodePythonSource } from "./python";
import { extractZipStrategy } from "./zip";
import {
  downloadStrategyFile,
  strategyPathForAudit,
  type StrategyStorageClient,
} from "./storage";

export type IngestedStrategy = NormalizedStrategy & {
  /* Reported in the ingestion timeline entry. */
  encodingNote: string | null;
};

/* Ingest the uploaded file owned by an audit row. Throws IngestionError
 * with a user-safe message on any failure — callers translate that into a
 * clean failed state, never an internal stack trace. */
export async function ingestUploadedStrategy(
  audit: {
    input_type: string;
    file_name: string | null;
    user_id: string;
    id: string;
    code: string;
  },
  client: StrategyStorageClient,
): Promise<IngestedStrategy> {
  const path = strategyPathForAudit(audit);
  if (!path) {
    throw new IngestionError(
      "This audit has no uploaded strategy file.",
      `ingestion called on non-upload audit ${audit.id}`,
    );
  }
  /* Normalized source already persisted (e.g., a retry after interruption
   * during the deterministic stages): reuse it, no re-download needed. */
  if (audit.code.trim().length > 0) {
    return { code: audit.code, segments: [], fileCount: 1, encodingNote: null };
  }

  const bytes = await downloadStrategyFile(client, path);

  const ext = extensionOf(audit.file_name ?? "") as AcceptedExtension;
  validateContentMatches(ext, bytes);

  if (ext === ".zip") {
    const extracted = extractZipStrategy(bytes, audit.file_name ?? "archive");
    return {
      code: extracted.code,
      segments: extracted.segments,
      fileCount: extracted.fileCount,
      encodingNote:
        extracted.fileCount > 1
          ? `${extracted.fileCount} Python files assembled for analysis`
          : null,
    };
  }

  const decoded = decodePythonSource(bytes, audit.file_name ?? "strategy");
  return {
    code: decoded.code,
    segments: [],
    fileCount: 1,
    encodingNote: decoded.encoding === "latin-1" ? "decoded as latin-1" : null,
  };
}
