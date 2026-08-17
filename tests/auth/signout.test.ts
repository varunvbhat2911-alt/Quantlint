import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/auth/logout/route";

// Mock Supabase server client
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("Sign Out", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls supabase.auth.signOut()", async () => {
    const mockSignOut = vi.fn().mockResolvedValue({ error: null });

    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockReturnValue({
      auth: {
        signOut: mockSignOut,
      },
    } as any);

    const response = await POST();
    const data = await response.json();

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(data.success).toBe(true);
  });

  it("returns 200 with success:true on successful sign out", async () => {
    const mockSignOut = vi.fn().mockResolvedValue({ error: null });

    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockReturnValue({
      auth: {
        signOut: mockSignOut,
      },
    } as any);

    const response = await POST();

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ success: true });
  });

  it("returns 500 with error message on sign out failure", async () => {
    const mockSignOut = vi.fn().mockResolvedValue({
      error: { message: "Session expired" },
    });

    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockReturnValue({
      auth: {
        signOut: mockSignOut,
      },
    } as any);

    const response = await POST();

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe("Sign out failed. Please try again.");
  });

  it("does not expose internal error details", async () => {
    const mockSignOut = vi.fn().mockResolvedValue({
      error: { message: "Internal database connection lost at 0x7f3a" },
    });

    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockReturnValue({
      auth: {
        signOut: mockSignOut,
      },
    } as any);

    const response = await POST();
    const data = await response.json();

    expect(data.error).not.toContain("database");
    expect(data.error).not.toContain("0x7f3a");
    expect(data.error).not.toContain("Internal");
  });
});
