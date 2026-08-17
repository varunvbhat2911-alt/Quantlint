/* Server-only structured logging (Node runtime).
 *
 * Emits single-line JSON to stdout/stderr so any log aggregator (or the host
 * platform) can parse it. Never logs secrets: callers must not pass source
 * code, passwords, tokens, Authorization headers, service-role keys,
 * Fireworks keys, or raw provider response bodies. The logger itself only
 * serializes the fields it is given.
 *
 * Node-only: this module uses process.stdout/stderr. It must NOT be imported
 * from Edge Runtime code (middleware). The Edge-safe request-correlation
 * helpers live in ./request-id.ts and are re-exported here for convenience so
 * API routes can import both log and the request-id helpers from one place.
 *
 * requestId is generated once per HTTP request (see middleware) and carried in
 * request-scoped AsyncLocalStorage (from ./request-id.ts) so every log line in
 * a request can be correlated. The audit id remains the audit-level identifier.
 */
import "server-only";
import { currentRequestId } from "./request-id";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = {
  auditId?: string;
  requestId?: string;
  userId?: string;
  durationMs?: number;
  status?: string | number;
  errorCode?: string;
  [key: string]: unknown;
};

// Re-export the Edge-safe correlation helpers so route code can import the
// whole server-logging surface from "@/lib/server/logger".
export { newRequestId, withRequestId, currentRequestId } from "./request-id";

function emit(level: LogLevel, event: string, fields?: LogFields): void {
  const payload: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    event,
  };
  const rid = fields?.requestId ?? currentRequestId();
  if (rid) payload.requestId = rid;
  if (fields) {
    for (const [k, v] of Object.entries(fields)) {
      if (k === "requestId") continue;
      if (v === undefined || v === null) continue;
      payload[k] = v;
    }
  }
  const line = JSON.stringify(payload);
  if (level === "error" || level === "warn") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export const log = {
  debug: (event: string, fields?: LogFields) => emit("debug", event, fields),
  info: (event: string, fields?: LogFields) => emit("info", event, fields),
  warn: (event: string, fields?: LogFields) => emit("warn", event, fields),
  error: (event: string, fields?: LogFields) => emit("error", event, fields),
};
