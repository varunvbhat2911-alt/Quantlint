/* ── Upload file validation ─────────────────────────────────
 *
 * Defense in depth: the frontend validates before upload, but the server
 * re-validates everything from actual bytes. Extensions alone are never
 * trusted — content magic numbers and text heuristics are checked too.
 * ──────────────────────────────────────────────────────────── */

import {
  ACCEPTED_EXTENSIONS,
  IngestionError,
  MAX_FILENAME_LENGTH,
  type AcceptedExtension,
} from "./types";

/* Basename + sanitize: strips any directory components the client may have
 * sent, removes control characters, trims decoration, caps length while
 * preserving the extension. Deterministic — used for BOTH the storage object
 * name and later re-derivation of the path, so it must never vary. */
export function sanitizeFileName(raw: string): string {
  let name = raw.replace(/\\/g, "/");
  name = name.split("/").pop() ?? "";
  name = name.replace(/[\x00-\x1f\x7f]/g, "");
  name = name.replace(/\s+/g, " ").trim();
  name = name.replace(/^\.+/, "").trim();
  if (name.length === 0) return "strategy";

  if (name.length > MAX_FILENAME_LENGTH) {
    const dot = name.lastIndexOf(".");
    const ext = dot > 0 ? name.slice(dot) : "";
    const keep = MAX_FILENAME_LENGTH - ext.length;
    name = name.slice(0, Math.max(1, keep)) + ext;
  }
  return name;
}

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

/* MIME allowlist per accepted extension. Browsers frequently report
 * "application/octet-stream" or "" for local files, and ZIPs masquerade as
 * many vendor MIMEs — the list accepts the benign common cases; content
 * magic is the real gate (see isZipMagic / decodePythonSource). */
const MIME_ALLOWLIST: Record<AcceptedExtension, string[]> = {
  ".py": [
    "",
    "text/x-python",
    "text/x-python-script",
    "application/x-python",
    "application/x-python-code",
    "text/plain",
    "application/octet-stream",
  ],
  ".zip": [
    "",
    "application/zip",
    "application/x-zip-compressed",
    "application/x-zip",
    "multipart/x-zip",
    "application/octet-stream",
  ],
};

export type ValidatedUpload = {
  safeName: string;
  ext: AcceptedExtension;
  size: number;
};

/* Validate an uploaded file's name, size, and MIME (where provided).
 * Throws IngestionError with a user-safe message on rejection. */
export function validateUploadFile(input: {
  name: string;
  size: number;
  mimeType?: string | null;
}): ValidatedUpload {
  const safeName = sanitizeFileName(input.name);
  const ext = extensionOf(safeName) as AcceptedExtension;

  if (!(ACCEPTED_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new IngestionError(
      "Only .py and .zip strategy files are supported.",
      `rejected extension "${ext}" for name "${input.name}"`,
    );
  }
  if (!Number.isFinite(input.size) || input.size <= 0) {
    throw new IngestionError("The uploaded file is empty.");
  }
  if (input.size > 10 * 1024 * 1024) {
    throw new IngestionError("Strategy file exceeds the 10 MB limit.");
  }
  const mime = (input.mimeType ?? "").trim().toLowerCase();
  if (mime && !MIME_ALLOWLIST[ext].includes(mime)) {
    throw new IngestionError(
      "The file contents do not match a supported strategy format.",
      `rejected MIME "${mime}" for ${ext}`,
    );
  }
  return { safeName, ext, size: input.size };
}

/* Local file header magic: a valid ZIP begins with PK\x03\x04 (PK\x05\x06
 * for an empty archive, PK\x07\x08 for spanned archives). */
export function isZipMagic(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  const [a, b, c, d] = bytes;
  return (
    a === 0x50 &&
    b === 0x4b &&
    ((c === 0x03 && d === 0x04) ||
      (c === 0x05 && d === 0x06) ||
      (c === 0x07 && d === 0x08))
  );
}

/* Text heuristic for Python sources: NUL bytes or an excessive share of
 * control characters (excluding tab/newline/cr) indicate binary content. */
export function looksLikeText(bytes: Uint8Array): boolean {
  const scan = Math.min(bytes.length, 8192);
  let controls = 0;
  for (let i = 0; i < scan; i++) {
    const b = bytes[i];
    if (b === 0) return false;
    if (b < 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0d) controls++;
  }
  return controls / Math.max(1, scan) < 0.1;
}

/* Cross-check declared extension against actual content: a .py must be text
 * (not a zip), a .zip must carry zip magic. Prevents mislabeled payloads
 * from reaching the extractors. */
export function validateContentMatches(
  ext: AcceptedExtension,
  bytes: Uint8Array,
): void {
  if (ext === ".zip" && !isZipMagic(bytes)) {
    throw new IngestionError(
      "The file is not a valid ZIP archive.",
      "zip extension without zip magic",
    );
  }
  if (ext === ".py" && isZipMagic(bytes)) {
    throw new IngestionError(
      "The file contents do not match a Python source file.",
      "py extension with zip magic",
    );
  }
  if (ext === ".py" && !looksLikeText(bytes)) {
    throw new IngestionError(
      "The file does not appear to be readable Python source.",
      "binary content heuristics failed",
    );
  }
}
