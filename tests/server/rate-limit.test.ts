/* Phase 9 unit tests — in-memory rate limiter + body size policy. */

import { describe, it, expect, beforeEach } from "vitest";
import {
  consume,
  rateKey,
  clientIp,
  readLimits,
  maxAuditsPerUser,
  tooManyRequests,
  type BucketConfig,
} from "@/lib/server/rate-limit";
import { effectiveMaxBodyBytes, rejectOversized } from "@/lib/server/body-limits";

function cfg(capacity: number, refillPerSecond: number): BucketConfig {
  return { capacity, refillPerSecond };
}

describe("consume — token bucket", () => {
  it("allows requests within capacity", () => {
    const k = rateKey("test", "ip-1");
    for (let i = 0; i < 5; i++) {
      const res = consume(k, cfg(5, 0.001), 1);
      expect(res.ok).toBe(true);
    }
  });

  it("rejects once the bucket is empty", () => {
    const k = rateKey("test", "ip-2");
    for (let i = 0; i < 3; i++) consume(k, cfg(3, 0.001), 1);
    const res = consume(k, cfg(3, 0.001), 1);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect("retryAfterMs" in res && res.retryAfterMs > 0).toBe(true);
      expect("limit" in res && res.limit).toBe(3);
    }
  });

  it("isolates buckets per key (per-user isolation)", () => {
    const cap = cfg(2, 0.001);
    consume(rateKey("test", "user-A"), cap, 2); // A exhausted
    const b = consume(rateKey("test", "user-B"), cap, 1);
    expect(b.ok).toBe(true); // B unaffected
  });

  it("refills over time", async () => {
    const k = rateKey("test", "ip-3");
    const c = cfg(1, 1000); // 1000 tokens/sec → ~instant refill
    const first = consume(k, c, 1);
    expect(first.ok).toBe(true);
    // After a tick the bucket should have refilled.
    await new Promise((r) => setTimeout(r, 5));
    const second = consume(k, c, 1);
    expect(second.ok).toBe(true);
  });

  it("handles malformed/missing IP safely", () => {
    const req = new Request("https://x/");
    const ip = clientIp(req);
    expect(typeof ip).toBe("string");
    // Falls back to 'unknown' → still buckets safely.
    expect(consume(rateKey("test", ip), cfg(1, 1), 1).ok).toBe(true);
  });
});

describe("readLimits — configurable", () => {
  it("returns conservative defaults", () => {
    const l = readLimits();
    expect(l.auditsCreate.capacity).toBeGreaterThan(0);
    expect(l.authSignupIp.capacity).toBeGreaterThan(0);
  });

  it("honors env overrides", () => {
    const prev = process.env.RATE_AUDITS_CREATE_CAP;
    process.env.RATE_AUDITS_CREATE_CAP = "3";
    try {
      expect(readLimits().auditsCreate.capacity).toBe(3);
    } finally {
      if (prev === undefined) delete process.env.RATE_AUDITS_CREATE_CAP;
      else process.env.RATE_AUDITS_CREATE_CAP = prev;
    }
  });
});

describe("maxAuditsPerUser — quota", () => {
  it("defaults to a sane positive value", () => {
    expect(maxAuditsPerUser()).toBeGreaterThan(0);
  });
});

describe("tooManyRequests — 429 response", () => {
  it("returns 429 with Retry-After", () => {
    const res = tooManyRequests({ ok: false, retryAfterMs: 5000, limit: 10 });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("5");
  });
});

describe("body-limits — oversized rejection", () => {
  beforeEach(() => {
    delete process.env.PLATFORM_BODY_BYTES;
  });

  it("rejects a request whose Content-Length exceeds the effective limit", () => {
    const limit = effectiveMaxBodyBytes();
    const req = new Request("https://x/", {
      method: "POST",
      headers: { "content-length": String(limit + 1) },
    });
    const res = rejectOversized(req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(413);
  });

  it("accepts a request within the limit", () => {
    const req = new Request("https://x/", {
      method: "POST",
      headers: { "content-length": "1024" },
    });
    expect(rejectOversized(req)).toBeNull();
  });

  it("accepts a request with no Content-Length (downstream byte checks still bind)", () => {
    const req = new Request("https://x/", { method: "POST" });
    expect(rejectOversized(req)).toBeNull();
  });

  it("PLATFORM_BODY_BYTES caps the effective limit below the app cap", () => {
    process.env.PLATFORM_BODY_BYTES = String(1024 * 1024); // 1 MB
    expect(effectiveMaxBodyBytes()).toBeLessThanOrEqual(1024 * 1024);
    delete process.env.PLATFORM_BODY_BYTES;
  });
});
