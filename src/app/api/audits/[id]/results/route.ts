import { createSupabaseAuditRepository } from "@/lib/audit-engine/repository";
import { buildAuditResultData } from "@/lib/audits/result-mapper";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* GET /api/audits/[id]/results — the completed audit's persisted findings,
 * metrics, recommendations, and timeline, shaped for the result page. */
export async function GET(
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
      result: buildAuditResultData(audit, results),
    });
  } catch (err) {
    console.error("[api/audits/results] failed:", err);
    return Response.json(
      { success: false, error: "Failed to load audit results." },
      { status: 500 },
    );
  }
}
