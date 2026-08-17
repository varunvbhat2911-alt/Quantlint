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

/* POST /api/auth/signup — email/password sign-up. When the project requires
 * email confirmation no session is created yet; the response says so.
 *
 * Phase 9: per-IP rate limiting to slow signup flooding; Supabase Auth still
 * throttles server-side. */
export async function POST(request: NextRequest) {
  const requestId = requestIdFrom(request);
  const limits = readLimits();
  const ip = clientIp(request);

  const ipRes = consume(rateKey("auth:signup:ip", ip), limits.authSignupIp);
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

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return withRequestId(
      Response.json(
        { success: false, error: "Please enter a valid email address." },
        { status: 400 },
      ),
      requestId,
    );
  }
  if (password.length < 6) {
    return withRequestId(
      Response.json(
        { success: false, error: "Password must be at least 6 characters." },
        { status: 400 },
      ),
      requestId,
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    log.warn("auth.signup_failed", {
      requestId,
      errorCode: "AUTH_SIGNUP_FAILED",
      status: error.status,
    });
    // 409 for "already registered" (was 401 in Phase 8 — semantically off).
    const status =
      error.status === 400 && /already registered/i.test(error.message) ? 409 : 401;
    return withRequestId(
      Response.json(
        { success: false, error: authErrorMessage(error.status, error.message) },
        { status },
      ),
      requestId,
    );
  }

  if (!data.session) {
    // Email confirmation required before a session exists.
    return withRequestId(
      Response.json({
        success: true,
        needsConfirmation: true,
        message: "Check your email to confirm your account, then sign in.",
      }),
      requestId,
    );
  }

  log.info("auth.signup_ok", { requestId, userId: data.user?.id });
  return withRequestId(
    Response.json({ success: true, needsConfirmation: false }),
    requestId,
  );
}
