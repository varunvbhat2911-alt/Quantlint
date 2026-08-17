/* Request-scoped helpers for API routes (server-only).
 *
 * requestId: re-use an inbound x-request-id (forwarded by middleware) or
 * generate a fresh one. Always echoed back on the response so an operator can
 * correlate a client report with server logs. */

import "server-only";
import { newRequestId } from "./logger";

export function requestIdFrom(request: Request): string {
  const inbound = request.headers.get("x-request-id");
  if (inbound && /^[A-Za-z0-9_-]{4,64}$/.test(inbound)) return inbound;
  return newRequestId();
}

/* Attach the request id to a Response so it is visible to clients/operators. */
export function withRequestId(response: Response, requestId: string): Response {
  response.headers.set("x-request-id", requestId);
  return response;
}
