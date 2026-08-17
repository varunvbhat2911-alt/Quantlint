import { NextRequest } from "next/server";
import {
  createAudit,
  deleteAudit,
  listAudits,
  parseCreateAuditRequest,
  AuditQuotaExceededError,
} from "@/lib/audits";
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
import {
  consume,
  rateKey,
  clientIp,
  readLimits,
  tooManyRequests,
} from "@/lib/server/rate-limit";
import { log } from "@/lib/server/logger";
import { requestIdFrom, withRequestId } from "@/lib/server/request";

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
    log.error("api.audits.list_failed", {
      userId: user.id,
      errorCode: "AUDIT_LIST_ERROR",
      ...errField(err),
    });
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
 *   authenticate → rate-limit → validate file → create queued audit →
 *   upload bytes to private storage under <user_id>/<audit_id>/<safe_filename>
 *   → return audit id. If the storage upload fails the partially-created
 *   audit row is removed so no broken audit pretends to have a file.
 *
 * Phase 9: per-user + per-IP rate limiting and a per-user audit quota. */
export async function POST(request: NextRequest) {
  const { user, response: unauthorized } = await requireUser();
  if (!user) return unauthorized;

  const requestId = requestIdFrom(request);
  const limits = readLimits();
  const ip = clientIp(request);

  // Per-IP and per-user token buckets. Either failing returns 429.
  const ipRes = consume(rateKey("audits:create:ip", ip), limits.auditsCreateIp);
  if (!ipRes.ok) return withRequestId(tooManyRequests(ipRes), requestId);
  const userRes = consume(rateKey("audits:create:user", user.id), limits.auditsCreate);
  if (!userRes.ok) return withRequestId(tooManyRequests(userRes), requestId);

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    return createUploadAudit(request, user.id, requestId);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return withRequestId(
      Response.json(
        { success: false, error: "Request body must be valid JSON." },
        { status: 400 },
      ),
      requestId,
    );
  }

  const parsed = parseCreateAuditRequest(body);
  if (!parsed.ok) {
    return withRequestId(
      Response.json(
        { success: false, error: parsed.error, details: parsed.details },
        { status: 400 },
      ),
      requestId,
    );
  }
  if (parsed.data.inputType === "upload") {
    return withRequestId(
      Response.json(
        {
          success: false,
          error:
            "Uploaded audits must use multipart/form-data with a 'file' field.",
        },
        { status: 400 },
      ),
      requestId,
    );
  }

  try {
    const audit = await createAudit(parsed.data, user.id);
    log.info("api.audits.created", { auditId: audit.id, requestId, userId: user.id });
    return withRequestId(
      Response.json(
        {
          success: true,
          audit: { id: audit.id, status: audit.status, progress: audit.progress },
        },
        { status: 201 },
      ),
      requestId,
    );
  } catch (err) {
    if (err instanceof AuditQuotaExceededError) {
      return withRequestId(
        Response.json({ success: false, error: err.message }, { status: 409 }),
        requestId,
      );
    }
    log.error("api.audits.create_failed", {
      requestId,
      userId: user.id,
      errorCode: "AUDIT_CREATE_ERROR",
      ...errField(err),
    });
    return withRequestId(
      Response.json(
        { success: false, error: "Failed to create the audit." },
        { status: 500 },
      ),
      requestId,
    );
  }
}

/* Multipart branch: file bytes are validated server-side, stored privately,
 * and only referenced by the audit row (code stays empty until ingestion
 * runs during execution). */
async function createUploadAudit(request: NextRequest, userId: string, requestId: string) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return withRequestId(
      Response.json(
        { success: false, error: "Request body must be valid multipart form data." },
        { status: 400 },
      ),
      requestId,
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return withRequestId(
      Response.json(
        { success: false, error: "A 'file' field is required." },
        { status: 400 },
      ),
      requestId,
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
    // IngestionError carries a safe userMessage; use it, never the internal
    // diagnostic in `message` (Phase 9 leak fix).
    const message =
      err instanceof Error && err.name === "IngestionError"
        ? (err as { userMessage?: string }).userMessage ??
          "The uploaded file could not be validated."
        : "The uploaded file could not be validated.";
    return withRequestId(
      Response.json({ success: false, error: message }, { status: 400 }),
      requestId,
    );
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
    return withRequestId(
      Response.json(
        { success: false, error: parsed.error, details: parsed.details },
        { status: 400 },
      ),
      requestId,
    );
  }

  let audit;
  try {
    audit = await createAudit(parsed.data, userId);
  } catch (err) {
    if (err instanceof AuditQuotaExceededError) {
      return withRequestId(
        Response.json({ success: false, error: err.message }, { status: 409 }),
        requestId,
      );
    }
    log.error("api.audits.create_upload_failed", {
      requestId,
      userId,
      errorCode: "AUDIT_CREATE_ERROR",
      ...errField(err),
    });
    return withRequestId(
      Response.json(
        { success: false, error: "Failed to create the audit." },
        { status: 500 },
      ),
      requestId,
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
    log.error("api.audits.storage_upload_failed", {
      requestId,
      auditId: audit.id,
      errorCode: "STORAGE_UPLOAD_ERROR",
      ...errField(err),
    });
    try {
      await deleteAudit(audit.id);
    } catch (cleanupErr) {
      log.error("api.audits.cleanup_after_failed_upload", {
        requestId,
        auditId: audit.id,
        ...errField(cleanupErr),
      });
    }
    return withRequestId(
      Response.json(
        { success: false, error: "Failed to store the strategy file." },
        { status: 502 },
      ),
      requestId,
    );
  }

  log.info("api.audits.created_upload", { requestId, auditId: audit.id, userId });
  return withRequestId(
    Response.json(
      {
        success: true,
        audit: { id: audit.id, status: audit.status, progress: audit.progress },
      },
      { status: 201 },
    ),
    requestId,
  );
}

function errField(err: unknown): { error: string } {
  return { error: err instanceof Error ? err.message : "unknown error" };
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
