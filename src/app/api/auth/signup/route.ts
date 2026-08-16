import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authErrorMessage } from "@/lib/auth/session";

/* POST /api/auth/signup — email/password sign-up. When the project requires
 * email confirmation no session is created yet; the response says so. */
export async function POST(request: NextRequest) {
  const body: unknown = await request.json().catch(() => null);
  const email =
    typeof body === "object" && body !== null
      ? String((body as { email?: unknown }).email ?? "").trim().toLowerCase()
      : "";
  const password =
    typeof body === "object" && body !== null
      ? String((body as { password?: unknown }).password ?? "")
      : "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json(
      { success: false, error: "Please enter a valid email address." },
      { status: 400 },
    );
  }
  if (password.length < 6) {
    return Response.json(
      { success: false, error: "Password must be at least 6 characters." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return Response.json(
      { success: false, error: authErrorMessage(error.status, error.message) },
      { status: 401 },
    );
  }

  if (!data.session) {
    // Email confirmation required before a session exists.
    return Response.json({
      success: true,
      needsConfirmation: true,
      message: "Check your email to confirm your account, then sign in.",
    });
  }

  return Response.json({ success: true, needsConfirmation: false });
}
