import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/audits/route";

// Mock Supabase server client
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("Protected Routes After Logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for unauthenticated user on protected API route", async () => {
    const request = new NextRequest("http://localhost:3000/api/audits");

    const { createClient } = await import("@/lib/supabase/server");
    const mockGetUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: null,
    });

    vi.mocked(createClient).mockReturnValue({
      auth: {
        getUser: mockGetUser,
      },
    } as any);

    const response = await GET(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe("Authentication required.");
  });

  it("returns 401 after sign-out clears session", async () => {
    // First, simulate authenticated state
    const { createClient } = await import("@/lib/supabase/server");
    
    // Simulate authenticated request
    const mockGetUserAuth = vi.fn().mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null,
    });

    vi.mocked(createClient).mockReturnValue({
      auth: {
        getUser: mockGetUserAuth,
      },
    } as any);

    const authRequest = new NextRequest("http://localhost:3000/api/audits");
    const authResponse = await GET(authRequest);
    expect(authResponse.status).not.toBe(401);

    // Now simulate post-logout state (session cleared)
    vi.clearAllMocks();
    const mockGetUserLoggedOut = vi.fn().mockResolvedValue({
      data: { user: null },
      error: null,
    });

    vi.mocked(createClient).mockReturnValue({
      auth: {
        getUser: mockGetUserLoggedOut,
      },
    } as any);

    const loggedOutRequest = new NextRequest("http://localhost:3000/api/audits");
    const loggedOutResponse = await GET(loggedOutRequest);

    expect(loggedOutResponse.status).toBe(401);
    const data = await loggedOutResponse.json();
    expect(data.error).toBe("Authentication required.");
  });
});
