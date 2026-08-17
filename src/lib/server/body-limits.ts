/* Centralized request body size policy (server-only).
 *
 * The application advertises a 10 MB source/upload limit. Some serverless
 * platforms impose a lower HARD request-body limit on route handlers
 * (e.g. Vercel serverless functions default to ~4.5 MB for the request body,
 * configurable via the platform, not Next.js). To avoid advertising a limit the
 * platform silently truncates, the EFFECTIVE limit is the smaller of the
 * application cap and a configurable platform cap (DEFAULT_PLATFORM_BODY_BYTES).
 *
 * Set PLATFORM_BODY_BYTES in the environment to match the deploy target's real
 * limit once known. Until then, the conservative default keeps client
 * validation and server rejection consistent.
 *
 * These constants are used by:
 *   - the audit creation validators (src/lib/audits/validation.ts, ingestion)
 *   - an explicit server-side guard in route handlers (reject oversized
 *     bodies BEFORE parsing, with a clear 413).
 */

import "server-only";

export const APP_MAX_BODY_BYTES = 10 * 1024 * 1024; // 10 MB application cap

/* Conservative platform default. Override via PLATFORM_BODY_BYTES when the
 * deploy target's real limit is confirmed. Must be > 0. */
export function platformBodyBytes(): number {
  const v = Number(process.env.PLATFORM_BODY_BYTES);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : APP_MAX_BODY_BYTES;
}

/* The effective limit actually enforced. */
export function effectiveMaxBodyBytes(): number {
  return Math.min(APP_MAX_BODY_BYTES, platformBodyBytes());
}

/* Human-readable limit for user-facing messages. */
export function effectiveMaxBodyLabel(): string {
  const mb = effectiveMaxBodyBytes() / (1024 * 1024);
  return `${mb % 1 === 0 ? mb.toFixed(0) : mb.toFixed(1)} MB`;
}

/* Reject a request whose Content-Length advertises a body above the effective
 * limit, before any parsing. Returns a 413 Response or null when acceptable.
 * Bodies without a Content-Length are accepted (the downstream size checks in
 * the validators still bound them by actual bytes). */
export function rejectOversized(request: Request): Response | null {
  const len = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(len) && len > effectiveMaxBodyBytes()) {
    return Response.json(
      {
        success: false,
        error: `Request body exceeds the ${effectiveMaxBodyLabel()} limit.`,
      },
      { status: 413 },
    );
  }
  return null;
}
