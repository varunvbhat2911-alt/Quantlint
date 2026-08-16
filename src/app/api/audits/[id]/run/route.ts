import { getAuditById, toAuditSummary } from "@/lib/audits";
import { createSupabaseAuditRepository } from "@/lib/audit-engine/repository";
import { runAudit } from "@/lib/audit-engine/execution";
import { requireUser } from "@/lib/auth/session";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* POST /api/audits/[id]/run — start server-side execution of the
 * AUTHENTICATED user's queued audit.
 *
 * Authorization first: the audit must be visible to this user through the
 * session client (RLS-enforced). Only then does the internal executor run
 * with the service-role repository — a deliberate internal operation after
 * explicit authorization, not an authorization mechanism itself. */
export async function POST(
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
    // Session client + RLS: another user's audit reads as missing here.
    audit = await getAuditById(id);
  } catch (err) {
    console.error("[api/audits/run] fetch failed:", err);
    return Response.json(
      { success: false, error: "Failed to start the audit." },
      { status: 500 },
    );
  }

  if (!audit) {
    return Response.json(
      { success: false, error: "Audit not found." },
      { status: 404 },
    );
  }

  if (audit.status === "queued") {
    // Internal execution after successful authorization; failures are
    // persisted as a clean failed state, never thrown to the client.
    void runAudit(id).catch((err) => {
      console.error("[api/audits/run] execution crashed:", err);
    });
    return Response.json(
      {
        success: true,
        audit: { id: audit.id, status: "running", progress: audit.progress },
      },
      { status: 202 },
    );
  }

  // Idempotent: already running, completed, or failed.
  return Response.json({ success: true, audit: toAuditSummary(audit) });
}
