import { toAuditSummary, getAuditById, deleteAudit } from "@/lib/audits";
import { requireUser } from "@/lib/auth/session";
import {
  createStrategyStorageClient,
  deleteStrategyFile,
  strategyPathForAudit,
} from "@/lib/audit-ingestion";

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
 * succeeds (documented behavior). */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response: unauthorized } = await requireUser();
  if (!user) return unauthorized;

  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return Response.json(
      { success: false, error: "Invalid audit id." },
      { status: 400 },
    );
  }

  try {
    /* Fetch first (RLS-scoped): foreign/unknown audits 404 before storage. */
    const audit = await getAuditById(id);
    if (!audit) {
      return Response.json(
        { success: false, error: "Audit not found." },
        { status: 404 },
      );
    }

    const storagePath = strategyPathForAudit(audit);

    const deleted = await deleteAudit(id);
    if (!deleted) {
      return Response.json(
        { success: false, error: "Audit not found." },
        { status: 404 },
      );
    }

    if (storagePath) {
      const removal = await deleteStrategyFile(
        createStrategyStorageClient(),
        storagePath,
      );
      if (!removal.ok) {
        console.error(
          `[api/audits] storage cleanup failed for ${storagePath}: ${removal.error}`,
        );
      }
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("[api/audits] delete failed:", err);
    return Response.json(
      { success: false, error: "Failed to delete the audit." },
      { status: 500 },
    );
  }
}

/* GET /api/audits/[id] — polling endpoint, authenticated. Reads go through
 * the session client under RLS, so another user's audit is indistinguishable
 * from a missing one (same safe 404). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response: unauthorized } = await requireUser();
  if (!user) return unauthorized;

  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return Response.json(
      { success: false, error: "Invalid audit id." },
      { status: 400 },
    );
  }

  let audit;
  try {
    audit = await getAuditById(id);
  } catch (err) {
    console.error("[api/audits] fetch failed:", err);
    return Response.json(
      { success: false, error: "Failed to fetch the audit." },
      { status: 500 },
    );
  }

  if (!audit) {
    return Response.json(
      { success: false, error: "Audit not found." },
      { status: 404 },
    );
  }

  return Response.json({ success: true, audit: toAuditSummary(audit) });
}
