import { describe, expect, it } from "vitest";
import {
  decideGuard,
  isAuthPage,
  isProtectedPath,
  PROTECTED_PREFIXES,
} from "@/lib/auth/route-guard";

describe("isProtectedPath", () => {
  it("protects the application areas", () => {
    expect(isProtectedPath("/dashboard")).toBe(true);
    expect(isProtectedPath("/audit/new")).toBe(true);
    expect(isProtectedPath("/audit/running")).toBe(true);
    expect(isProtectedPath("/history")).toBe(true);
    expect(isProtectedPath("/report/abc")).toBe(true);
    expect(isProtectedPath("/settings")).toBe(true);
  });

  it("does not protect public areas", () => {
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/auth/login")).toBe(false);
    expect(isProtectedPath("/auth/signup")).toBe(false);
    expect(isProtectedPath("/auth/callback")).toBe(false);
    expect(isProtectedPath("/docs")).toBe(false);
    expect(isProtectedPath("/404")).toBe(false);
  });

  it("does not false-positive on prefix-similar public paths", () => {
    expect(isProtectedPath("/dashboard-public")).toBe(false);
    expect(isProtectedPath("/audits-explainer")).toBe(false);
    expect(isProtectedPath("/historical-notes")).toBe(false);
  });

  it("covers every intended protected prefix", () => {
    expect(PROTECTED_PREFIXES).toEqual(
      expect.arrayContaining(["/dashboard", "/audit", "/history", "/report", "/settings"]),
    );
  });
});

describe("isAuthPage", () => {
  it("matches exactly the auth pages", () => {
    expect(isAuthPage("/auth/login")).toBe(true);
    expect(isAuthPage("/auth/signup")).toBe(true);
    expect(isAuthPage("/auth/callback")).toBe(false);
    expect(isAuthPage("/auth")).toBe(false);
  });
});

describe("decideGuard", () => {
  it("redirects unauthenticated users from protected routes to login with a return path", () => {
    const decision = decideGuard("/audit/new", false);
    expect(decision.action).toBe("redirect");
    if (decision.action === "redirect") {
      expect(decision.location).toBe(
        `/auth/login?next=${encodeURIComponent("/audit/new")}`,
      );
    }
  });

  it("allows unauthenticated users on public pages", () => {
    expect(decideGuard("/", false).action).toBe("allow");
    expect(decideGuard("/auth/login", false).action).toBe("allow");
    expect(decideGuard("/docs/some-slug", false).action).toBe("allow");
  });

  it("sends authenticated users away from auth pages", () => {
    const decision = decideGuard("/auth/login", true);
    expect(decision.action).toBe("redirect");
    if (decision.action === "redirect") {
      expect(decision.location).toBe("/dashboard");
    }
  });

  it("allows authenticated users everywhere else", () => {
    expect(decideGuard("/dashboard", true).action).toBe("allow");
    expect(decideGuard("/audit/running", true).action).toBe("allow");
  });
});
