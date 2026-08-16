import { NextRequest } from "next/server";
import { createAudit, listAudits, parseCreateAuditRequest } from "@/lib/audits";
import { parseListQuery } from "@/lib/audits/list-query";
import { requireUser } from "@/lib/auth/session";

/* GET /api/audits — paginated, filtered listing of the AUTHENTICATED user's
 * audits (RLS-scoped through the session client). No source code, violations,
 * or AI payloads are returned — this stays a lightweight list. */
export async function GET(request: NextRequest) {
  const { user, response: unauthorized } = await requireUser();
  if (!user) return unauthorized;

  const parsed = parseListQuery(request.nextUrl.searchParams);
  if (!parsed.ok) {
    return Response.json(
      { success: false, error: parsed.error, details: parsed.details },
      { status: 400 },
    );
  }

  try {
    const result = await listAudits(parsed.params);
    return Response.json({
      success: true,
      audits: result.audits,
      pagination: result.pagination,
      summary: result.summary,
    });
  } catch (err) {
    console.error("[api/audits] list failed:", err);
    return Response.json(
      { success: false, error: "Failed to list audits." },
      { status: 500 },
    );
  }
}

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
