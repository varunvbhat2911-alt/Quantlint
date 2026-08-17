/* Request correlation — Edge-runtime safe.
 *
 * Imported by middleware (Edge Runtime) AND by API routes / the worker, so it
 * must not use Node-only APIs like process.stdout. Only AsyncLocalStorage
 * (WinterCG baseline, supported in both Node and the Edge Runtime) and Web
 * Crypto are used.
 *
 * requestId is generated once per HTTP request and carried in request-scoped
 * storage so every log line and error response for one request shares one id.
 * The audit id remains the audit-level identifier; no second audit id is used. */

import { AsyncLocalStorage } from "node:async_hooks";

type LogContext = { requestId?: string };

const requestContext = new AsyncLocalStorage<LogContext>();

/* Generate a short, URL-safe, unpredictable request id. Edge-safe. */
export function newRequestId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const b64 = btoa(String.fromCharCode(...bytes));
  return `req_${b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}

/* Run a handler with a requestId in scope. */
export function withRequestId<T>(
  requestId: string,
  fn: () => Promise<T> | T,
): Promise<T> | T {
  return requestContext.run({ requestId }, fn);
}

export function currentRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}
