import { getAuditStats } from "@/lib/audits";
import { requireUser } from "@/lib/auth/session";
import { log } from "@/lib/server/logger";

/* GET /api/audits/stats — counts of the AUTHENTICATED user's audits by
 * status. Derived from real rows only; nothing fabricated. */
export async function GET() {
  const { user, response: unauthorized } = await requireUser();
  if (!user) return unauthorized;

  try {
    const stats = await getAuditStats();
    return Response.json({ success: true, stats });
  } catch (err) {
    log.error("api.audits.stats.failed", { error: String(err) });
    return Response.json(
      { success: false, error: "Failed to load audit statistics." },
      { status: 500 },
    );
  }
}
