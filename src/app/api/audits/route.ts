import { NextRequest } from "next/server";
import { createAudit, deleteAudit, listAudits, parseCreateAuditRequest } from "@/lib/audits";
import { parseListQuery } from "@/lib/audits/list-query";
import { requireUser } from "@/lib/auth/session";
import {
  createStrategyStorageClient,
  uploadStrategyFile,
  validateContentMatches,
  validateUploadFile,
  extractZipStrategy,
  decodePythonSource,
} from "@/lib/audit-ingestion";

/* GET /api/audits — paginated, filtered listing of the AUTHENTICATED user's
 * audits (RLS-scoped through the session client). No source code, violations,
 * or AI payloads are returned — this stays a lightweight list. */
export async function GET(request: NextRequest) {
  const { user, response: unauthorized } = await requireUser();
  if (!user) return unauthorized;

  const parsed = parseListQuery(request.nextUrl.searchParams);
  if (!parsed.ok) {
    return Response.json(
      { success: false, error: parsed.error, details: parsed.details },
      { status: 400 },
    );
  }

  try {
    const result = await listAudits(parsed.params);
    return Response.json({
      success: true,
      audits: result.audits,
      pagination: result.pagination,
      summary: result.summary,
    });
  } catch (err) {
    console.error("[api/audits] list failed:", err);
    return Response.json(
      { success: false, error: "Failed to list audits." },
      { status: 500 },
    );
  }
}

/* POST /api/audits — create a queued audit job for the AUTHENTICATED user.
 * Ownership comes from the server-verified session; any user_id supplied by
 * the browser is ignored (never read). 401 when unauthenticated.
 *
 * Two request shapes:
 *   application/json        → pasted code (existing behavior, unchanged)
 *   multipart/form-data     → uploaded .py/.zip file (Phase 6)
 *
 * Upload lifecycle (server-authoritative throughout):
 *   authenticate → validate file (name/ext/MIME/size/content magic) →
 *   create queued audit → upload bytes to private storage under
 *   <user_id>/<audit_id>/<safe_filename> → return audit id. If the storage
 *   upload fails the partially-created audit row is removed so no broken
 *   audit pretends to have a file. */
export async function POST(request: NextRequest) {
  const { user, response: unauthorized } = await requireUser();
  if (!user) return unauthorized;

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    return createUploadAudit(request, user.id);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { success: false, error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = parseCreateAuditRequest(body);
  if (!parsed.ok) {
    return Response.json(
      { success: false, error: parsed.error, details: parsed.details },
      { status: 400 },
    );
  }
  if (parsed.data.inputType === "upload") {
    return Response.json(
      {
        success: false,
        error:
          "Uploaded audits must use multipart/form-data with a 'file' field.",
      },
      { status: 400 },
    );
  }

  try {
    const audit = await createAudit(parsed.data, user.id);
    return Response.json(
      {
        success: true,
        audit: {
          id: audit.id,
          status: audit.status,
          progress: audit.progress,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[api/audits] create failed:", err);
    return Response.json(
      { success: false, error: "Failed to create the audit." },
      { status: 500 },
    );
  }
}

/* Multipart branch: file bytes are validated server-side, stored privately,
 * and only referenced by the audit row (code stays empty until ingestion
 * runs during execution). */
async function createUploadAudit(request: NextRequest, userId: string) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json(
      { success: false, error: "Request body must be valid multipart form data." },
      { status: 400 },
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json(
      { success: false, error: "A 'file' field is required." },
      { status: 400 },
    );
  }

  /* Validate from actual bytes — extension, size, MIME, content magic, and
   * a full content pass: archives are safety-checked (traversal, bombs,
   * entry limits, at least one .py) and Python is decode-checked BEFORE any
   * audit row or storage object is created. The extraction result is
   * discarded — ingestion during execution remains authoritative. */
  let validated;
  try {
    validated = validateUploadFile({
      name: file.name,
      size: file.size,
      mimeType: file.type,
    });
    const bytes = new Uint8Array(await file.arrayBuffer());
    validated = { ...validated, bytes };
    validateContentMatches(validated.ext, bytes);
    if (validated.ext === ".zip") {
      extractZipStrategy(bytes, validated.safeName);
    } else {
      decodePythonSource(bytes, validated.safeName);
    }
  } catch (err) {
    const message =
      err instanceof Error && err.name === "IngestionError"
        ? err.message
        : "The uploaded file could not be validated.";
    return Response.json({ success: false, error: message }, { status: 400 });
  }

  /* Reuse the exact JSON validation for configuration fields. */
  const parsed = parseCreateAuditRequest({
    strategyName: form.get("strategyName") ?? "",
    inputType: "upload",
    fileName: validated.safeName,
    framework: form.get("framework") ?? undefined,
    analysisDepth: form.get("analysisDepth") ?? undefined,
    ruleCategories: parseRuleCategoriesField(form.get("ruleCategories")),
    code: "",
  });
  if (!parsed.ok) {
    return Response.json(
      { success: false, error: parsed.error, details: parsed.details },
      { status: 400 },
    );
  }

  let audit;
  try {
    audit = await createAudit(parsed.data, userId);
  } catch (err) {
    console.error("[api/audits] create (upload) failed:", err);
    return Response.json(
      { success: false, error: "Failed to create the audit." },
      { status: 500 },
    );
  }

  /* Storage upload AFTER the audit id exists (path needs it). On failure,
   * remove the row — a broken audit must not pretend to have a file. */
  try {
    await uploadStrategyFile(createStrategyStorageClient(), {
      userId,
      auditId: audit.id,
      fileName: validated.safeName,
      bytes: validated.bytes,
    });
  } catch (err) {
    console.error(
      `[api/audits] storage upload failed for ${audit.id}:`,
      err instanceof Error ? err.message : err,
    );
    try {
      await deleteAudit(audit.id);
    } catch (cleanupErr) {
      console.error(
        `[api/audits] cleanup after failed upload left audit ${audit.id}:`,
        cleanupErr instanceof Error ? cleanupErr.message : cleanupErr,
      );
    }
    return Response.json(
      { success: false, error: "Failed to store the strategy file." },
      { status: 502 },
    );
  }

  return Response.json(
    {
      success: true,
      audit: { id: audit.id, status: audit.status, progress: audit.progress },
    },
    { status: 201 },
  );
}

/* ruleCategories arrives as a JSON array string (the frontend serializes
 * it). Anything unparseable is passed through as null so the shared
 * validation rejects it with a precise message. */
function parseRuleCategoriesField(value: FormDataEntryValue | null): unknown {
  if (value === null) return undefined;
  const raw = typeof value === "string" ? value : "";
  if (raw.trim() === "") return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
