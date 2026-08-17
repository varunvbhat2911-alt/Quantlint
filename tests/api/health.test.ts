/* Phase 9 unit tests — health endpoints.
 *
 * Liveness is pure (no deps) so it is exercised directly. Readiness depends on
 * the Supabase session client (cookies); its config-flag logic is verified by
 * importing the route and stubbing the server client module via vitest's
 * module mocking. */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("GET /api/health (liveness)", () => {
  it("returns 200 { ok:true } and no-store cache", async () => {
    const mod = await import("@/app/api/health/route");
    const res = await mod.GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.status).toBe("alive");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("never includes secrets or config values", async () => {
    const mod = await import("@/app/api/health/route");
    const res = await mod.GET();
    const text = JSON.stringify(await res.json());
    // No key-like strings.
    expect(/eyJ|sk-|Bearer|service_role|SUPABASE_SERVICE_ROLE/i.test(text)).toBe(false);
  });
});

describe("GET /api/health/ready (readiness)", () => {
  const origFetch = globalThis.fetch;
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "pub-key-value";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";
    process.env.FIREWORKS_API_KEY = "fw";
  });
  afterEach(() => {
    globalThis.fetch = origFetch;
    vi.restoreAllMocks();
  });

  it("returns 200 ready when config is present and Auth answers (200 healthy)", async () => {
    globalThis.fetch = (async () => new Response("ok", { status: 200 })) as typeof fetch;
    const mod = await import("@/app/api/health/ready/route");
    const res = await mod.GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ready).toBe(true);
    expect(body.checks.supabaseConfig).toBe(true);
    expect(body.checks.authReachable).toBe(true);
    expect(body.checks.aiConfigured).toBe(true);
  });

  it("treats HTTP 401 (answered but rejected) as Auth reachable", async () => {
    // The service answered — a missing/anonymous API key is rejected, but the
    // service is provably up. This is the exact false-negative the fix targets.
    globalThis.fetch = (async () =>
      new Response("unauthorized", { status: 401 })) as typeof fetch;
    const mod = await import("@/app/api/health/ready/route");
    const res = await mod.GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ready).toBe(true);
    expect(body.checks.authReachable).toBe(true);
  });

  it("treats HTTP 403 (answered but forbidden) as Auth reachable", async () => {
    globalThis.fetch = (async () =>
      new Response("forbidden", { status: 403 })) as typeof fetch;
    const mod = await import("@/app/api/health/ready/route");
    const res = await mod.GET();
    const body = await res.json();
    expect(body.checks.authReachable).toBe(true);
    expect(body.ready).toBe(true);
  });

  it("returns 503 when the Auth probe fails at the transport layer (network/DNS)", async () => {
    globalThis.fetch = (async () => {
      throw new TypeError("fetch failed: ENOTFOUND");
    }) as typeof fetch;
    const mod = await import("@/app/api/health/ready/route");
    const res = await mod.GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ready).toBe(false);
    expect(body.checks.authReachable).toBe(false);
  });

  it("returns 503 when the Auth probe times out (AbortError)", async () => {
    globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      // Emulate an abort firing before any response: reject with AbortError.
      const sig = init?.signal;
      if (sig && sig.aborted) throw new DOMException("aborted", "AbortError");
      // Simulate the route's timeout by aborting immediately on first read.
      throw new DOMException("aborted", "AbortError");
    }) as typeof fetch;
    const mod = await import("@/app/api/health/ready/route");
    const res = await mod.GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.checks.authReachable).toBe(false);
  });

  it("returns 503 when the service-role key is missing", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    globalThis.fetch = (async () => new Response("ok", { status: 200 })) as typeof fetch;
    const mod = await import("@/app/api/health/ready/route");
    const res = await mod.GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.checks.supabaseConfig).toBe(false);
  });

  it("never reveals credentials, URLs, or keys in the body", async () => {
    globalThis.fetch = (async () => new Response("ok", { status: 200 })) as typeof fetch;
    const mod = await import("@/app/api/health/ready/route");
    const res = await mod.GET();
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain("svc");
    expect(text).not.toContain("fw");
    expect(text).not.toContain("pub-key-value");
    expect(text).not.toContain("example.supabase.co");
    expect(/service_role|SUPABASE_SERVICE_ROLE|apikey|authorization/i.test(text)).toBe(false);
  });

  it("treats Fireworks as optional (ready even when AI is unconfigured)", async () => {
    delete process.env.FIREWORKS_API_KEY;
    globalThis.fetch = (async () => new Response("ok", { status: 200 })) as typeof fetch;
    const mod = await import("@/app/api/health/ready/route");
    const res = await mod.GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ready).toBe(true);
    expect(body.checks.aiConfigured).toBe(false);
  });

  it("does not make a Fireworks HTTP request", async () => {
    const seenUrls: string[] = [];
    globalThis.fetch = (async (url: RequestInfo | URL) => {
      seenUrls.push(String(url));
      return new Response("ok", { status: 200 });
    }) as typeof fetch;
    const mod = await import("@/app/api/health/ready/route");
    await mod.GET();
    const fireworksCalls = seenUrls.filter((u) => /fireworks/i.test(u));
    expect(fireworksCalls).toEqual([]);
  });

  it("sends the publishable key as the Supabase apikey header, not in the URL", async () => {
    let captured: { url?: string; headers?: Record<string, string> } = {};
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      captured = {
        url: String(url),
        headers: init?.headers as Record<string, string> | undefined,
      };
      return new Response("ok", { status: 200 });
    }) as typeof fetch;
    const mod = await import("@/app/api/health/ready/route");
    await mod.GET();
    // The key must travel in a header, never in the query string.
    expect(captured.url).toContain("/auth/v1/health");
    expect(captured.url).not.toContain("pub-key-value");
    const headers = captured.headers ?? {};
    // Headers may be a Headers instance or a plain object.
    const apikey =
      headers["apikey"] ??
      headers["apiKey"] ??
      (headers as unknown as { get?: (k: string) => string | null }).get?.("apikey");
    expect(apikey).toBe("pub-key-value");
  });
});
