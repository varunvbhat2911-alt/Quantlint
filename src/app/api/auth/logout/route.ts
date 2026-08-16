import { createClient } from "@/lib/supabase/server";

/* POST /api/auth/logout — clears the session cookies. */
export async function POST() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return Response.json(
      { success: false, error: "Sign out failed. Please try again." },
      { status: 500 },
    );
  }
  return Response.json({ success: true });
}
