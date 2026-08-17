/* Phase 9 unit tests — structured logging + requestId correlation. */

import { describe, it, expect } from "vitest";
import { log, newRequestId, withRequestId, currentRequestId } from "@/lib/server/logger";
import { requestIdFrom, withRequestId as withReqIdResponse } from "@/lib/server/request";

describe("newRequestId", () => {
  it("produces a req_ prefixed, URL-safe id", () => {
    const id = newRequestId();
    expect(id.startsWith("req_")).toBe(true);
    expect(id.length).toBeGreaterThan("req_".length + 8);
    expect(/^[A-Za-z0-9_-]+$/.test(id)).toBe(true);
  });

  it("is (effectively) unique across calls", () => {
    const a = newRequestId();
    const b = newRequestId();
    expect(a).not.toBe(b);
  });
});

describe("withRequestId — AsyncLocalStorage correlation", () => {
  it("exposes the requestId inside the scope and clears it after", () => {
    const id = newRequestId();
    expect(currentRequestId()).toBeUndefined();
    withRequestId(id, () => {
      expect(currentRequestId()).toBe(id);
    });
    expect(currentRequestId()).toBeUndefined();
  });

  it("nests correctly (inner restores outer on exit)", () => {
    const outer = "req_outer";
    const inner = "req_inner";
    withRequestId(outer, () => {
      expect(currentRequestId()).toBe(outer);
      withRequestId(inner, () => {
        expect(currentRequestId()).toBe(inner);
      });
      expect(currentRequestId()).toBe(outer);
    });
  });
});

describe("log — structured JSON output", () => {
  it("emits a single JSON line with event + level + requestId when scoped", () => {
    const lines: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    const origErr = process.stderr.write.bind(process.stderr);
    (process.stdout as { write: (s: string) => boolean }).write = (s: string) => {
      lines.push(s);
      return true;
    };
    (process.stderr as { write: (s: string) => boolean }).write = () => true;
    try {
      const id = newRequestId();
      withRequestId(id, () => {
        log.info("test.event", { auditId: "a-1", status: "completed" });
      });
      const parsed = JSON.parse(lines[0]!);
      expect(parsed.event).toBe("test.event");
      expect(parsed.level).toBe("info");
      expect(parsed.requestId).toBe(id);
      expect(parsed.auditId).toBe("a-1");
      expect(parsed.status).toBe("completed");
      expect(typeof parsed.ts).toBe("string");
      // No secret fields leaked by the logger itself.
      expect(parsed.error).toBeUndefined();
    } finally {
      (process.stdout as { write: (s: string) => boolean }).write = origWrite;
      (process.stderr as { write: (s: string) => boolean }).write = origErr;
    }
  });

  it("routes warn/error to stderr", () => {
    let sawErr = false;
    const origErr = process.stderr.write.bind(process.stderr);
    (process.stderr as { write: (s: string) => boolean }).write = (s: string) => {
      sawErr = true;
      return true;
    };
    try {
      log.error("test.err");
    } finally {
      (process.stderr as { write: (s: string) => boolean }).write = origErr;
    }
    expect(sawErr).toBe(true);
  });
});

describe("requestIdFrom / withRequestId response", () => {
  it("accepts a well-formed inbound x-request-id", () => {
    const req = new Request("https://x/", {
      headers: { "x-request-id": "req_inbound_12345" },
    });
    expect(requestIdFrom(req)).toBe("req_inbound_12345");
  });

  it("rejects a malformed inbound id and generates a fresh one", () => {
    const req = new Request("https://x/", {
      headers: { "x-request-id": "!!!bad" },
    });
    const id = requestIdFrom(req);
    expect(id.startsWith("req_")).toBe(true);
    expect(id).not.toBe("!!!bad");
  });

  it("generates a fresh id when none is present", () => {
    const req = new Request("https://x/");
    const id = requestIdFrom(req);
    expect(id.startsWith("req_")).toBe(true);
  });

  it("sets x-request-id on the response", () => {
    const res = new Response(null, { status: 200 });
    const id = "req_test_abc";
    const out = withReqIdResponse(res, id);
    expect(out.headers.get("x-request-id")).toBe(id);
  });
});
