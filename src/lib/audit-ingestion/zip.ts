/* ── ZIP strategy extraction ───────────────────────────────
 *
 * Archives are NEVER trusted and NEVER extracted to the filesystem.
 * Entries are decompressed in-memory through a pre-decompression filter
 * that enforces size/count limits (zip-bomb defense) and path safety
 * (Zip Slip / traversal / absolute paths). Only .py entries are analyzed.
 * ──────────────────────────────────────────────────────────── */

import { unzipSync } from "fflate";
import {
  IngestionError,
  MAX_NORMALIZED_CHARS,
  MAX_ZIP_ENTRIES,
  MAX_ZIP_ENTRY_BYTES,
  MAX_ZIP_PATH_DEPTH,
  MAX_ZIP_TOTAL_BYTES,
  type NormalizedStrategy,
  type SourceSegment,
} from "./types";
import { decodePythonSource } from "./python";

/* Normalize entry names: Windows archives use backslashes; we judge every
 * name as a POSIX-ish relative path. */
function normalizeEntryName(raw: string): string {
  return raw.replace(/\\/g, "/").replace(/^\.\//, "");
}

/* Reject names that could escape a user-scoped directory or confuse the
 * assembly: absolute paths, traversal segments, drive letters, control
 * characters, excessive depth/length. */
function assertSafeEntryPath(name: string): void {
  if (name.length === 0) {
    throw new IngestionError("The archive contains an entry with an empty name.");
  }
  if (/[\x00-\x1f\x7f]/.test(name)) {
    throw new IngestionError(
      "The archive contains an entry with an unsafe file name.",
      `control characters in entry name: ${JSON.stringify(name)}`,
    );
  }
  if (name.startsWith("/") || /^[a-zA-Z]:/.test(name)) {
    throw new IngestionError(
      "The archive contains absolute paths, which are not allowed.",
      `absolute entry name: ${JSON.stringify(name)}`,
    );
  }
  const segments = name.split("/");
  if (segments.some((s) => s === "..")) {
    throw new IngestionError(
      "The archive contains path traversal entries, which are not allowed.",
      `traversal in entry name: ${JSON.stringify(name)}`,
    );
  }
  if (segments.length > MAX_ZIP_PATH_DEPTH) {
    throw new IngestionError(
      "The archive nests files too deeply.",
      `entry depth ${segments.length}: ${JSON.stringify(name)}`,
    );
  }
  if (name.length > 400) {
    throw new IngestionError(
      "The archive contains an entry with an excessively long path.",
      `entry name length ${name.length}`,
    );
  }
}

export type ZipExtraction = NormalizedStrategy & {
  /* Entry names that were directories (not analyzed). */
  skippedNonPython: number;
};

/* Deterministic entry order: plain lexicographic on the normalized path.
 * A stable order keeps audits reproducible byte-for-byte across uploads. */
function entryOrder(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/* Extract a ZIP archive into a normalized strategy source.
 *
 * Multi-file projects are assembled with one deterministic header comment
 * per file:
 *
 *   # ── file: relative/path.py ──
 *   <original source lines…>
 *
 * `segments` records where each file's original content starts so engine
 * findings map back to true file/line positions. A single .py inside the
 * archive skips headers entirely — its line numbers are already original. */
export function extractZipStrategy(
  bytes: Uint8Array,
  archiveLabel = "archive",
): ZipExtraction {
  let entryCount = 0;
  let totalOriginal = 0;
  const pythonEntries = new Set<string>();

  /* fflate invokes the filter BEFORE decompressing each entry; throwing here
   * aborts extraction without ever inflating the offending data. */
  const filter = (info: { name: string; originalSize: number }) => {
    entryCount++;
    if (entryCount > MAX_ZIP_ENTRIES) {
      throw new IngestionError(
        "The archive contains too many files (limit 200).",
        `entry count exceeded at ${JSON.stringify(info.name)}`,
      );
    }
    const original =
      info.originalSize >= 0 ? info.originalSize : MAX_ZIP_ENTRY_BYTES + 1;
    if (original > MAX_ZIP_ENTRY_BYTES) {
      throw new IngestionError(
        "The archive contains a file larger than 5 MB when decompressed.",
        `entry too large (${original} bytes): ${JSON.stringify(info.name)}`,
      );
    }
    totalOriginal += original;
    if (totalOriginal > MAX_ZIP_TOTAL_BYTES) {
      throw new IngestionError(
        "The archive expands beyond the 20 MB total limit.",
        `total uncompressed size exceeded at ${JSON.stringify(info.name)}`,
      );
    }

    const name = normalizeEntryName(info.name);
    assertSafeEntryPath(name);
    if (name.endsWith("/") || !name.toLowerCase().endsWith(".py")) {
      return false; // directories and non-Python files are not analyzed
    }
    pythonEntries.add(name);
    return true;
  };

  let files: { name: string; data: Uint8Array }[];
  try {
    const extracted = unzipSync(bytes, { filter });
    files = Object.entries(extracted).map(([name, data]) => ({
      name: normalizeEntryName(name),
      data,
    }));
  } catch (err) {
    if (err instanceof IngestionError) throw err;
    throw new IngestionError(
      "The archive is malformed and could not be read.",
      `zip decode failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const pythonFiles = files
    .filter((f) => pythonEntries.has(f.name))
    .sort((a, b) => entryOrder(a.name, b.name));

  if (pythonFiles.length === 0) {
    throw new IngestionError(
      "The archive contains no Python (.py) files to analyze.",
      `no python entries in ${archiveLabel}`,
    );
  }

  const skippedNonPython = entryCount - pythonFiles.length;

  /* Single file: return it directly — line numbers already match. */
  if (pythonFiles.length === 1) {
    const only = pythonFiles[0];
    const decoded = decodePythonSource(only.data, only.name);
    return { code: decoded.code, segments: [], fileCount: 1, skippedNonPython };
  }

  /* Multi-file assembly with per-file headers and a segment table. */
  const parts: string[] = [];
  const segments: SourceSegment[] = [];
  let currentLine = 1;

  for (const file of pythonFiles) {
    const decoded = decodePythonSource(file.data, file.name);
    const header = `# ── file: ${file.name} ──`;
    const contentLines = decoded.code.split("\n");
    const startLine = currentLine + 1; // header occupies currentLine

    parts.push(header, decoded.code, "");
    segments.push({
      path: file.name,
      startLine,
      lineCount: contentLines.length,
    });
    currentLine = startLine + contentLines.length + 1; // +1 blank separator
  }

  const code = parts.join("\n");
  if (code.length > MAX_NORMALIZED_CHARS) {
    throw new IngestionError(
      "The archive's Python sources exceed the 10 MB analysis limit.",
      `assembled length ${code.length}`,
    );
  }

  return { code, segments, fileCount: pythonFiles.length, skippedNonPython };
}
