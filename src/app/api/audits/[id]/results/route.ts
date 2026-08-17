import { createSupabaseAuditRepository } from "@/lib/audit-engine/repository";
import { buildAuditResultData } from "@/lib/audits/result-mapper";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { log } from "@/lib/server/logger";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* GET /api/audits/[id]/results — the AUTHENTICATED user's persisted
 * findings, metrics, recommendations, timeline, and AI explanations.
 * All reads run through the session client under RLS, so ownership
 * (including child rows) is enforced database-side. */
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

  // Session-scoped repository: RLS filters both the audit and its children.
  const repository = createSupabaseAuditRepository(await createClient());

  try {
    const audit = await repository.getAudit(id);
    if (!audit) {
      return Response.json(
        { success: false, error: "Audit not found." },
        { status: 404 },
      );
    }

    if (audit.status !== "completed" && audit.status !== "failed") {
      return Response.json(
        {
          success: false,
          error: `Audit is ${audit.status}; results are available once it completes.`,
        },
        { status: 409 },
      );
    }

    const results = await repository.getResults(id);
    return Response.json({
      success: true,
      audit: { id: audit.id, status: audit.status },
      result: buildAuditResultData(audit, results),
    });
  } catch (err) {
    log.error("api.audits.results.failed", { auditId: id, error: String(err) });
    return Response.json(
      { success: false, error: "Failed to load audit results." },
      { status: 500 },
    );
  }
}
