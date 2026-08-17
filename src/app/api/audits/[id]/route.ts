import { NextRequest } from "next/server";
import { toAuditSummary, getAuditById, deleteAudit } from "@/lib/audits";
import { requireUser } from "@/lib/auth/session";
import {
  createStrategyStorageClient,
  deleteStrategyFile,
  strategyPathForAudit,
} from "@/lib/audit-ingestion";
import { log } from "@/lib/server/logger";
import { requestIdFrom, withRequestId } from "@/lib/server/request";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* DELETE /api/audits/[id] — delete the AUTHENTICATED user's own audit.
 * RLS restricts the delete to owned rows (foreign/unknown → 404); children
 * cascade via FK. Ownership cannot be overridden by the browser.
 *
 * Uploaded audits also remove their private storage object. The object path
 * is derived server-side from the owned row, so User A can never remove
 * User B's object (foreign rows 404 before any storage call). If the
 * database delete succeeds but the storage delete fails, the row is gone
 * and the orphaned object is inert — its path is no longer derivable from
 * any audit; the failure is logged server-side and the delete still
 * succeeds (documented behavior). Storage cleanup is idempotent. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response: unauthorized } = await requireUser();
  if (!user) return unauthorized;
  const requestId = requestIdFrom(request);

  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return withRequestId(
      Response.json(
        { success: false, error: "Invalid audit id." },
        { status: 400 },
      ),
      requestId,
    );
  }

  try {
    /* Fetch first (RLS-scoped): foreign/unknown audits 404 before storage. */
    const audit = await getAuditById(id);
    if (!audit) {
      return withRequestId(
        Response.json(
          { success: false, error: "Audit not found." },
          { status: 404 },
        ),
        requestId,
      );
    }

    const storagePath = strategyPathForAudit(audit);

    const deleted = await deleteAudit(id);
    if (!deleted) {
      return withRequestId(
        Response.json(
          { success: false, error: "Audit not found." },
          { status: 404 },
        ),
        requestId,
      );
    }

    if (storagePath) {
      const removal = await deleteStrategyFile(
        createStrategyStorageClient(),
        storagePath,
      );
      if (!removal.ok) {
        log.warn("api.audits.storage_cleanup_failed", {
          requestId,
          auditId: id,
          errorCode: "STORAGE_CLEANUP_WARNING",
          error: removal.error ?? "unknown",
        });
      }
    }

    log.info("api.audits.deleted", { requestId, auditId: id, userId: user.id });
    return withRequestId(Response.json({ success: true }), requestId);
  } catch (err) {
    log.error("api.audits.delete_failed", {
      requestId,
      auditId: id,
      errorCode: "AUDIT_DELETE_ERROR",
      ...errField(err),
    });
    return withRequestId(
      Response.json(
        { success: false, error: "Failed to delete the audit." },
        { status: 500 },
      ),
      requestId,
    );
  }
}

/* GET /api/audits/[id] — polling endpoint, authenticated. Reads go through
 * the session client under RLS, so another user's audit is indistinguishable
 * from a missing one (same safe 404). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response: unauthorized } = await requireUser();
  if (!user) return unauthorized;
  const requestId = requestIdFrom(request);

  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return withRequestId(
      Response.json(
        { success: false, error: "Invalid audit id." },
        { status: 400 },
      ),
      requestId,
    );
  }

  let audit;
  try {
    audit = await getAuditById(id);
  } catch (err) {
    log.error("api.audits.fetch_failed", {
      requestId,
      auditId: id,
      errorCode: "AUDIT_FETCH_ERROR",
      ...errField(err),
    });
    return withRequestId(
      Response.json(
        { success: false, error: "Failed to fetch the audit." },
        { status: 500 },
      ),
      requestId,
    );
  }

  if (!audit) {
    return withRequestId(
      Response.json(
        { success: false, error: "Audit not found." },
        { status: 404 },
      ),
      requestId,
    );
  }

  return withRequestId(
    Response.json({ success: true, audit: toAuditSummary(audit) }),
    requestId,
  );
}

function errField(err: unknown): { error: string } {
  return { error: err instanceof Error ? err.message : "unknown error" };
}
