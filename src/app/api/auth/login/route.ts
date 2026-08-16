import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authErrorMessage } from "@/lib/auth/session";

/* POST /api/auth/login — email/password sign-in. Session cookies are set by
 * the request-scoped server client's cookie adapter. */
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

  if (!email || !password) {
    return Response.json(
      { success: false, error: "Email and password are required." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    return Response.json(
      {
        success: false,
        error: error
          ? authErrorMessage(error.status, error.message)
          : "Invalid email or password.",
      },
      { status: 401 },
    );
  }

  return Response.json({
    success: true,
    user: { id: data.user.id, email: data.user.email },
  });
}
