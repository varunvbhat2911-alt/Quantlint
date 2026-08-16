/* Pure route-protection decision logic — unit-tested in
 * tests/auth/route-guard.test.ts and used by src/middleware.ts. */

export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/audit",
  "/history",
  "/report",
  "/settings",
] as const;

export const AUTH_PAGES = ["/auth/login", "/auth/signup"] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isAuthPage(pathname: string): boolean {
  return (AUTH_PAGES as readonly string[]).includes(pathname);
}

export type GuardDecision =
  | { action: "allow" }
  | { action: "redirect"; location: string };

/* Unauthenticated users are sent to login (with a return path);
 * authenticated users browsing auth pages are sent to the dashboard. */
export function decideGuard(pathname: string, hasUser: boolean): GuardDecision {
  if (!hasUser && isProtectedPath(pathname)) {
    const next = encodeURIComponent(pathname);
    return { action: "redirect", location: `/auth/login?next=${next}` };
  }
  if (hasUser && isAuthPage(pathname)) {
    return { action: "redirect", location: "/dashboard" };
  }
  return { action: "allow" };
}
