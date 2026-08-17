import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/auth/callback/route";

// Mock Supabase server client
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("Google OAuth Callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid code parameter", async () => {
    const request = new NextRequest(
      "http://localhost:3000/auth/callback?code=invalid-code&next=/dashboard"
    );

    const { createClient } = await import("@/lib/supabase/server");
    const mockExchangeCode = vi.fn().mockResolvedValue({
      data: { session: null },
      error: { message: "Invalid code" },
    });

    vi.mocked(createClient).mockReturnValue({
      auth: {
        exchangeCodeForSession: mockExchangeCode,
      },
    } as any);

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/auth/login");
    expect(response.headers.get("location")).toContain("error=confirmation-failed");
  });

  it("does not allow open redirect via next parameter", async () => {
    const maliciousUrls = [
      "https://evil.com",
      "//evil.com",
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
    ];

    for (const maliciousNext of maliciousUrls) {
      const request = new NextRequest(
        `http://localhost:3000/auth/callback?code=test-code&next=${encodeURIComponent(maliciousNext)}`
      );

      const { createClient } = await import("@/lib/supabase/server");
      const mockExchangeCode = vi.fn().mockResolvedValue({
        data: { session: { user: { id: "user-123" } } },
        error: null,
      });

      vi.mocked(createClient).mockReturnValue({
        auth: {
          exchangeCodeForSession: mockExchangeCode,
        },
      } as any);

      const response = await GET(request);

      expect(response.status).toBe(307);
      const location = response.headers.get("location");
      expect(location).not.toContain("evil.com");
      expect(location).not.toContain("javascript:");
      expect(location).not.toContain("data:");
      // Should redirect to /dashboard as fallback
      expect(location).toMatch(/\/dashboard$/);
    }
  });

  it("redirects to safe internal path after successful OAuth", async () => {
    const safePaths = ["/dashboard", "/audit/new", "/history", "/settings"];

    for (const safeNext of safePaths) {
      const request = new NextRequest(
        `http://localhost:3000/auth/callback?code=test-code&next=${encodeURIComponent(safeNext)}`
      );

      const { createClient } = await import("@/lib/supabase/server");
      const mockExchangeCode = vi.fn().mockResolvedValue({
        data: { session: { user: { id: "user-123" } } },
        error: null,
      });

      vi.mocked(createClient).mockReturnValue({
        auth: {
          exchangeCodeForSession: mockExchangeCode,
        },
      } as any);

      const response = await GET(request);

      expect(response.status).toBe(307);
      const location = response.headers.get("location");
      expect(location).toContain(safeNext);
    }
  });

  it("defaults to /dashboard when next parameter is missing", async () => {
    const request = new NextRequest(
      "http://localhost:3000/auth/callback?code=test-code"
    );

    const { createClient } = await import("@/lib/supabase/server");
    const mockExchangeCode = vi.fn().mockResolvedValue({
      data: { session: { user: { id: "user-123" } } },
      error: null,
    });

    vi.mocked(createClient).mockReturnValue({
      auth: {
        exchangeCodeForSession: mockExchangeCode,
      },
    } as any);

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/dashboard");
  });
});

describe("Google OAuth Security", () => {
  it("does not expose tokens in URL", async () => {
    const request = new NextRequest(
      "http://localhost:3000/auth/callback?code=test-code&next=/dashboard"
    );

    const { createClient } = await import("@/lib/supabase/server");
    const mockExchangeCode = vi.fn().mockResolvedValue({
      data: {
        session: {
          user: { id: "user-123" },
          access_token: "secret-access-token",
          refresh_token: "secret-refresh-token",
        },
      },
      error: null,
    });

    vi.mocked(createClient).mockReturnValue({
      auth: {
        exchangeCodeForSession: mockExchangeCode,
      },
    } as any);

    const response = await GET(request);

    const location = response.headers.get("location");
    expect(location).not.toContain("secret-access-token");
    expect(location).not.toContain("secret-refresh-token");
    expect(location).not.toContain("test-code");
  });

  it("handles callback without code parameter", async () => {
    const request = new NextRequest(
      "http://localhost:3000/auth/callback?next=/dashboard"
    );

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/auth/login");
    expect(response.headers.get("location")).toContain("error=confirmation-failed");
  });
});
