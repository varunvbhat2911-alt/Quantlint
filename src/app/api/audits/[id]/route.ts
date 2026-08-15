import { toAuditSummary, getAuditById } from "@/lib/audits";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* GET /api/audits/[id] — polling endpoint. Returns the audit summary
 * (status, progress, strategy info) without internal DB details. */
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
