import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/* Email-confirmation callback: exchanges the auth code (PKCE) for a session,
 * writing cookies server-side, then redirects into the app. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  // Safe internal redirect only
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  const redirectUrl = new URL("/auth/login", origin);
  redirectUrl.searchParams.set("error", "confirmation-failed");
  return NextResponse.redirect(redirectUrl);
}
