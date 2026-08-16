import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { decideGuard } from "@/lib/auth/route-guard";

/* Supabase SSR session refresh + route protection (current recommended
 * pattern). getUser() validates the JWT against the auth server — no
 * database queries run here. API routes are excluded: they refresh sessions
 * through their own request-scoped client and enforce auth themselves. */

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Validated server-side; refreshes rotated session cookies into response.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const decision = decideGuard(request.nextUrl.pathname, Boolean(user));
  if (decision.action === "redirect") {
    const redirectUrl = request.nextUrl.clone();
    const [pathOnly, query] = decision.location.split("?");
    redirectUrl.pathname = pathOnly;
    redirectUrl.search = query ? `?${query}` : "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|auth/callback|docs|404|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css|txt|xml|map)$).*)",
  ],
};
