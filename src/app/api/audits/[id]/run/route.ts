import { createSupabaseAuditRepository } from "@/lib/audit-engine/repository";
import { runAudit } from "@/lib/audit-engine/execution";
import { toAuditSummary } from "@/lib/audits";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* POST /api/audits/[id]/run — start server-side execution of a queued audit.
 *
 * Execution runs detached from the request so the polling endpoint can
 * observe real stage-by-stage progress; a future background worker replaces
 * this trigger without touching runAudit(). Safe on a long-running Next.js
 * server (next dev / next start); serverless deploys will need the queue. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return Response.json(
      { success: false, error: "Invalid audit id." },
      { status: 400 },
    );
  }

  const repository = createSupabaseAuditRepository();

  let audit;
  try {
    audit = await repository.getAudit(id);
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
    // Detached execution; errors are handled inside runAudit (failure state
    // is persisted, never thrown to the client).
    void runAudit(id, repository).catch((err) => {
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

  // Idempotent: already running, completed, or failed — report current state.
  return Response.json({ success: true, audit: toAuditSummary(audit) });
}
