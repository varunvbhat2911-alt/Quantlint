/* In-memory token-bucket rate limiter (server-only, no Redis).
 *
 * Application-level abuse protection for the expensive endpoints. Bounded
 * memory: a lazy sweeper drops idle buckets once the table exceeds a soft cap,
 * and every bucket carries an `lastSeen` so stale entries expire deterministically.
 *
 * Accuracy caveat: state is per-process. On a long-running Node server it is
 * exact; on multi-instance serverless it is best-effort (each instance has its
 * own buckets). This deliberately raises the bar vs. having no protection,
 * without introducing Redis. Supabase Auth continues to provide its own
 * server-side throttling for login/signup as a backstop.
 *
 * No credentials, request bodies, or sensitive payloads are stored — only the
 * bucket key (IP or user id) and token count. */

import "server-only";

export type BucketConfig = {
  /* Bucket capacity (max burst). */
  capacity: number;
  /* Tokens added per second. */
  refillPerSecond: number;
};

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterMs: number; limit: number };

export type RateLimitKey = string;

type Bucket = { tokens: number; lastRefillMs: number; lastSeenMs: number };

const SOFT_MAX_BUCKETS = 10_000;
const SWEEP_BATCH = 256;
const STALE_AFTER_MS = 30 * 60 * 1000; // 30 min idle → eligible for sweep

const buckets = new Map<RateLimitKey, Bucket>();
let lastSweepMs = 0;

function nowMs(): number {
  return Date.now();
}

function refill(b: Bucket, cfg: BucketConfig, t: number): void {
  const elapsed = Math.max(0, t - b.lastRefillMs);
  const added = (elapsed / 1000) * cfg.refillPerSecond;
  b.tokens = Math.min(cfg.capacity, b.tokens + added);
  b.lastRefillMs = t;
}

function maybeSweep(t: number): void {
  // Throttle sweeps to once per minute, and only when the table is large.
  if (buckets.size < SOFT_MAX_BUCKETS && t - lastSweepMs < 60_000) return;
  lastSweepMs = t;
  let checked = 0;
  for (const [k, b] of buckets) {
    if (t - b.lastSeenMs > STALE_AFTER_MS) buckets.delete(k);
    if (++checked >= SWEEP_BATCH) break;
  }
}

/* Consume `cost` tokens from the bucket identified by `key`. Returns ok:true
 * when allowed, or ok:false with a retry-after hint when the bucket is empty. */
export function consume(
  key: RateLimitKey,
  cfg: BucketConfig,
  cost = 1,
): RateLimitResult {
  const t = nowMs();
  maybeSweep(t);
  let b = buckets.get(key);
  if (!b) {
    b = { tokens: cfg.capacity, lastRefillMs: t, lastSeenMs: t };
    buckets.set(key, b);
  }
  refill(b, cfg, t);
  b.lastSeenMs = t;
  if (b.tokens >= cost) {
    b.tokens -= cost;
    return { ok: true };
  }
  const deficit = cost - b.tokens;
  const retryAfterMs = Math.ceil((deficit / cfg.refillPerSecond) * 1000);
  return { ok: false, retryAfterMs, limit: cfg.capacity };
}

/* Compose a stable key from parts (e.g. endpoint + ip / endpoint + userId). */
export function rateKey(...parts: string[]): RateLimitKey {
  return parts.join("|");
}

/* Extract the client IP from request headers (first hop of x-forwarded-for),
 * falling back to 'unknown' so malformed/missing headers still bucket safely. */
export function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

/* Centralized, env-configurable limits. Conservative defaults that don't break
 * normal development (a developer running audits in a tight loop stays well
 * under the per-user cap). */
export type Limits = {
  auditsCreate: BucketConfig; // per-user
  auditsCreateIp: BucketConfig; // per-IP
  auditsRun: BucketConfig; // per-user
  auditsRunIp: BucketConfig; // per-IP
  authLoginIp: BucketConfig;
  authSignupIp: BucketConfig;
};

function envInt(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

export function readLimits(): Limits {
  return {
    auditsCreate: {
      capacity: envInt("RATE_AUDITS_CREATE_CAP", 10),
      refillPerSecond: envInt("RATE_AUDITS_CREATE_REFILL", 10) / 60,
    },
    auditsCreateIp: {
      capacity: envInt("RATE_AUDITS_CREATE_IP_CAP", 20),
      refillPerSecond: envInt("RATE_AUDITS_CREATE_IP_REFILL", 20) / 60,
    },
    auditsRun: {
      capacity: envInt("RATE_AUDITS_RUN_CAP", 10),
      refillPerSecond: envInt("RATE_AUDITS_RUN_REFILL", 10) / 60,
    },
    auditsRunIp: {
      capacity: envInt("RATE_AUDITS_RUN_IP_CAP", 20),
      refillPerSecond: envInt("RATE_AUDITS_RUN_IP_REFILL", 20) / 60,
    },
    authLoginIp: {
      capacity: envInt("RATE_AUTH_LOGIN_IP_CAP", 10),
      refillPerSecond: envInt("RATE_AUTH_LOGIN_IP_REFILL", 10) / 60,
    },
    authSignupIp: {
      capacity: envInt("RATE_AUTH_SIGNUP_IP_CAP", 5),
      refillPerSecond: envInt("RATE_AUTH_SIGNUP_IP_REFILL", 5) / 60,
    },
  };
}

/* Per-user audit quota (enforced in createAudit). Configurable via env. */
export function maxAuditsPerUser(): number {
  return envInt("MAX_AUDITS_PER_USER", 100);
}

/* Build a 429 Response carrying Retry-After and a safe body. */
export function tooManyRequests(res: RateLimitResult & { ok: false }): Response {
  const retryAfter = Math.max(1, Math.ceil(res.retryAfterMs / 1000));
  return Response.json(
    { success: false, error: "Too many requests. Please slow down." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}
