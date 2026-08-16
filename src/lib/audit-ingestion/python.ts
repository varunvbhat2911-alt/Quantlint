/* ── Python source decoding ────────────────────────────────
 *
 * Uploaded Python is DATA. It is decoded (never imported, never executed,
 * never spawned) into text for the static-analysis engine.
 * ──────────────────────────────────────────────────────────── */

import { IngestionError } from "./types";
import { looksLikeText } from "./validation";

export type DecodedSource = {
  code: string;
  /* Encoding actually used. "utf-8" covers BOM-stripped strict UTF-8;
   * "latin-1" documents the fallback (see decodePythonSource). */
  encoding: "utf-8" | "latin-1";
};

/* Decode raw bytes into Python source text.
 *
 * - UTF-8 BOM is stripped.
 * - Strict UTF-8 first (the overwhelmingly common case).
 * - Fallback: latin-1. This is a DOCUMENTED mapping, not silent corruption:
 *   latin-1 maps every byte 0x00–0xFF to the same code point, so the decode
 *   never fails and byte offsets remain inspectable. The encoding used is
 *   reported to the caller and surfaced in the ingestion timeline so
 *   non-UTF-8 uploads are visible, not hidden.
 * - Line endings normalize to \n so engine line numbers and regexes see one
 *   consistent form (\r\n and lone \r both collapse).
 * - Binary content and empty sources are rejected cleanly. */
export function decodePythonSource(
  bytes: Uint8Array,
  label = "file",
): DecodedSource {
  if (bytes.length === 0) {
    throw new IngestionError(
      `The strategy file (${label}) is empty.`,
      `empty source: ${label}`,
    );
  }
  if (!looksLikeText(bytes)) {
    throw new IngestionError(
      `The strategy file (${label}) does not appear to be readable Python source.`,
      `binary heuristics failed: ${label}`,
    );
  }

  let work = bytes;
  if (work.length >= 3 && work[0] === 0xef && work[1] === 0xbb && work[2] === 0xbf) {
    work = work.subarray(3);
  }

  let encoding: "utf-8" | "latin-1" = "utf-8";
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(work);
  } catch {
    encoding = "latin-1";
    // WHATWG decoders alias "latin1" to windows-1252; every byte maps to a
    // code point, so the decode never fails (documented fallback).
    text = new TextDecoder("latin1").decode(work);
  }

  const code = text.replace(/\r\n?/g, "\n");

  if (code.trim().length === 0) {
    throw new IngestionError(
      `The strategy file (${label}) contains no code.`,
      `whitespace-only source: ${label}`,
    );
  }
  return { code, encoding };
}
