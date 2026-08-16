import { getSessionUser } from "@/lib/auth/session";

/* GET /api/auth/me — current authenticated identity (server-validated). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return Response.json(
      { success: false, error: "Authentication required." },
      { status: 401 },
    );
  }
  return Response.json({ success: true, user });
}
