import { log } from "@/lib/server/logger";

/* GET /api/health — liveness. Proves the application process responds.
 * No dependency checks, no secrets, no auth. Cheap and fast. */
export async function GET() {
  log.debug("health.liveness_ok");
  return Response.json(
    { ok: true, status: "alive" },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
