import { getAuditById, toAuditSummary } from "@/lib/audits";
import { createSupabaseAuditRepository } from "@/lib/audit-engine/repository";
import { runAudit } from "@/lib/audit-engine/execution";
import { requireUser } from "@/lib/auth/session";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* POST /api/audits/[id]/run — start or retry server-side execution of the
 * AUTHENTICATED user's audit.
 *
 * Authorization first: the audit must be visible to this user through the
 * session client (RLS-enforced). Only then does the internal executor run
 * with the service-role repository — a deliberate internal operation after
 * explicit authorization, not an authorization mechanism itself.
 *
 * Phase 8 additions:
 * - Opportunistic stale sweep before processing (recoverStaleAudits).
 * - Failed audits can be retried: children are atomically deleted and the
 *   audit is reset to 'queued' before execution starts.
 * - Completed audits remain immutable (no rerun). */
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

  // Phase 8 #6: opportunistic stale sweep — runs before processing any run
  // request so stuck audits are recovered without cron. Best-effort: a
  // failure here must not block the current audit.
  try {
    await createSupabaseAuditRepository().recoverStale();
  } catch (err) {
    console.error("[api/audits/run] stale sweep failed:", err);
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

  if (audit.status === "failed") {
    // Phase 8 #4: atomic retry — delete children, reset to queued, then run.
    const repository = createSupabaseAuditRepository();
    let reset = false;
    try {
      reset = await repository.resetForRetry(id);
    } catch (err) {
      console.error("[api/audits/run] retry reset failed:", err);
      return Response.json(
        { success: false, error: "Failed to retry the audit." },
        { status: 500 },
      );
    }
    if (!reset) {
      // Another concurrent retry already claimed the transition.
      return Response.json({ success: true, audit: toAuditSummary(audit) });
    }
    void runAudit(id, repository).catch((err) => {
      console.error("[api/audits/run] retry execution crashed:", err);
    });
    return Response.json(
      {
        success: true,
        audit: { id: audit.id, status: "queued", progress: 0 },
      },
      { status: 202 },
    );
  }

  // Idempotent: already running or completed.
  return Response.json({ success: true, audit: toAuditSummary(audit) });
}
