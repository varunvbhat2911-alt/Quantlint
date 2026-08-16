import { NextRequest } from "next/server";
import { createAudit, parseCreateAuditRequest } from "@/lib/audits";
import { requireUser } from "@/lib/auth/session";

/* POST /api/audits — create a queued audit job for the AUTHENTICATED user.
 * Ownership comes from the server-verified session; any user_id supplied by
 * the browser is ignored (never read). 401 when unauthenticated. */
export async function POST(request: NextRequest) {
  const { user, response: unauthorized } = await requireUser();
  if (!user) return unauthorized;

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
    const audit = await createAudit(parsed.data, user.id);
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
