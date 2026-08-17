import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authErrorMessage } from "@/lib/auth/session";
import {
  consume,
  rateKey,
  clientIp,
  readLimits,
  tooManyRequests,
} from "@/lib/server/rate-limit";
import { log } from "@/lib/server/logger";
import { requestIdFrom, withRequestId } from "@/lib/server/request";

/* POST /api/auth/login — email/password sign-in. Session cookies are set by
 * the request-scoped server client's cookie adapter.
 *
 * Phase 9: per-IP rate limiting on top of Supabase Auth's built-in throttling.
 * Failed attempts are logged with the requestId for brute-force visibility. */
export async function POST(request: NextRequest) {
  const requestId = requestIdFrom(request);
  const limits = readLimits();
  const ip = clientIp(request);

  const ipRes = consume(rateKey("auth:login:ip", ip), limits.authLoginIp);
  if (!ipRes.ok) return withRequestId(tooManyRequests(ipRes), requestId);

  const body: unknown = await request.json().catch(() => null);
  const email =
    typeof body === "object" && body !== null
      ? String((body as { email?: unknown }).email ?? "").trim().toLowerCase()
      : "";
  const password =
    typeof body === "object" && body !== null
      ? String((body as { password?: unknown }).password ?? "")
      : "";

  if (!email || !password) {
    return withRequestId(
      Response.json(
        { success: false, error: "Email and password are required." },
        { status: 400 },
      ),
      requestId,
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    log.warn("auth.login_failed", {
      requestId,
      errorCode: error?.status === 429 ? "AUTH_RATE_LIMITED" : "AUTH_LOGIN_FAILED",
      status: error?.status,
    });
    return withRequestId(
      Response.json(
        {
          success: false,
          error: error
            ? authErrorMessage(error.status, error.message)
            : "Invalid email or password.",
        },
        { status: 401 },
      ),
      requestId,
    );
  }

  log.info("auth.login_ok", { requestId, userId: data.user.id });
  return withRequestId(
    Response.json({
      success: true,
      user: { id: data.user.id, email: data.user.email },
    }),
    requestId,
  );
}
