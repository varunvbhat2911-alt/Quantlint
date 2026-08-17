import { isAdminClientConfigured } from "@/lib/supabase/admin";
import { log } from "@/lib/server/logger";

/* GET /api/health/ready — readiness. Checks that required dependencies and
 * configuration are present and reachable. Returns 200 when ready, 503 when
 * not. NEVER reveals credentials, service-role keys, connection strings, raw
 * Supabase URLs, or internal stack traces — only boolean/derived flags.
 *
 * Checks:
 *   - Supabase URL + publishable key configured (env presence, not values).
 *   - Service-role key configured (presence only).
 *   - Supabase Auth reachable: a minimal direct HTTP probe to the Auth
 *     service's /auth/v1/health endpoint, sending the publishable key as the
 *     Supabase apikey header. ANY HTTP response (the service answered) counts
 *     as reachable — 200 (healthy) or 401/403 (answered but rejected) both
 *     prove reachability. Only a transport failure (network/DNS/timeout/abort)
 *     counts as unreachable. This replaces an anonymous auth.getUser() probe,
 *     which returned an auth error for empty sessions even when Auth was
 *     reachable (false-negative readiness).
 *
 * Fireworks is optional (audits run deterministic-only without it), so its
 * absence is reported as `ai: false` but does NOT fail readiness. No Fireworks
 * HTTP request is made here — only the key's presence is checked. */

/* Bounded timeout so readiness can never hang indefinitely. */
const AUTH_PROBE_TIMEOUT_MS = 5_000;

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const checks = {
    supabaseUrl: Boolean(supabaseUrl),
    supabasePublishableKey: Boolean(publishableKey),
    serviceRoleKey: isAdminClientConfigured(),
    ai: Boolean(process.env.FIREWORKS_API_KEY?.trim()),
  };

  // Probe Auth reachability only when the URL + publishable key are configured.
  // Without them, supabaseConfig is already false and the probe cannot run.
  let authReachable = false;
  if (supabaseUrl && publishableKey) {
    authReachable = await probeAuthReachable(supabaseUrl, publishableKey);
  }

  const configOk =
    checks.supabaseUrl && checks.supabasePublishableKey && checks.serviceRoleKey;
  const ready = configOk && authReachable;

  log.info("health.readiness", {
    status: ready ? "ready" : "not_ready",
    authReachable,
    aiConfigured: checks.ai,
  });

  return Response.json(
    {
      ready,
      // Derived flags only — no values, no URLs, no keys.
      checks: {
        supabaseConfig: configOk,
        authReachable,
        aiConfigured: checks.ai,
      },
    },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

/* Minimal server-side reachability probe for Supabase Auth.
 *
 * Sends the publishable key as the Supabase apikey header (and the equivalent
 * Bearer header, matching @supabase/supabase-js anon-request convention). The
 * publishable key is designed to be public; it is never logged or returned.
 *
 * Returns true when the service answered with ANY HTTP response (200 healthy,
 * 401/403 answered-but-rejected — both prove reachability). Returns false on
 * a transport failure: network error, DNS failure, timeout (AbortController),
 * or any other fetch rejection. Never throws to the caller. */
async function probeAuthReachable(
  supabaseUrl: string,
  publishableKey: string,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AUTH_PROBE_TIMEOUT_MS);
  try {
    await fetch(`${supabaseUrl}/auth/v1/health`, {
      method: "GET",
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
      },
      signal: controller.signal,
      cache: "no-store",
    });
    // Any HTTP response means the Auth service answered → reachable.
    return true;
  } catch {
    // Network failure, DNS failure, timeout (abort), or other transport error.
    return false;
  } finally {
    clearTimeout(timer);
  }
}
