/* Server-side auth session helpers.
 *
 * Identity ALWAYS comes from the Supabase Auth session (server-validated by
 * @supabase/ssr getUser()) — never from browser-supplied user ids. */

import { createClient } from "@/lib/supabase/server";

export type SessionUser = {
  id: string;
  email: string | null;
};

/* Returns the authenticated user, or null. Refreshes the session cookie
 * when the server client rotates tokens. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return { id: user.id, email: user.email ?? null };
}

/* Route-handler guard: returns the user, or a ready-to-return 401 Response. */
export async function requireUser(): Promise<
  { user: SessionUser; response: null } | { user: null; response: Response }
> {
  const user = await getSessionUser();
  if (!user) {
    return {
      user: null,
      response: Response.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      ),
    };
  }
  return { user, response: null };
}

/* Map Supabase auth errors to safe, user-facing messages — raw provider
 * errors never reach the browser. */
export function authErrorMessage(status: number | undefined, message: string): string {
  if (status === 400 && /invalid login credentials/i.test(message)) {
    return "Invalid email or password.";
  }
  if (status === 400 && /already registered/i.test(message)) {
    return "An account with this email already exists.";
  }
  if (status === 422 || /password/i.test(message)) {
    return "Password must be at least 6 characters.";
  }
  if (status === 429) {
    return "Too many attempts — please wait a moment and try again.";
  }
  return "Authentication failed. Please try again.";
}
