import { NextRequest } from "next/server";
import { createAudit, parseCreateAuditRequest } from "@/lib/audits";

/* POST /api/audits — create a queued audit job from AuditDraft-compatible
 * JSON. 201 with the new audit id, 400 on invalid input, 5xx on failure. */
export async function POST(request: NextRequest) {
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

  try {
    const audit = await createAudit(parsed.data);
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
