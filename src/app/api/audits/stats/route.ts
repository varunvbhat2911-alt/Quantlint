import { getAuditStats } from "@/lib/audits";
import { requireUser } from "@/lib/auth/session";

/* GET /api/audits/stats — counts of the AUTHENTICATED user's audits by
 * status. Derived from real rows only; nothing fabricated. */
export async function GET() {
  const { user, response: unauthorized } = await requireUser();
  if (!user) return unauthorized;

  try {
    const stats = await getAuditStats();
    return Response.json({ success: true, stats });
  } catch (err) {
    console.error("[api/audits/stats] failed:", err);
    return Response.json(
      { success: false, error: "Failed to load audit statistics." },
      { status: 500 },
    );
  }
}
