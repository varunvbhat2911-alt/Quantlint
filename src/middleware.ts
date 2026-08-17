import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { decideGuard } from "@/lib/auth/route-guard";
import { newRequestId, withRequestId } from "@/lib/server/request-id";

/* Supabase SSR session refresh + route protection (current recommended
 * pattern). getUser() validates the JWT against the auth server — no
 * database queries run here. API routes are excluded: they refresh sessions
 * through their own request-scoped client and enforce auth themselves.
 *
 * A requestId is generated per request and forwarded to downstream handlers via
 * the x-request-id request header so every route and log line for one request
 * shares one correlation id. It is also set on the response. */

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Generate (or accept a well-formed inbound) request id for correlation.
  const inbound = request.headers.get("x-request-id");
  const requestId =
    inbound && /^[A-Za-z0-9_-]{4,64}$/.test(inbound) ? inbound : newRequestId();
  // Make the id visible to downstream route handlers.
  request.headers.set("x-request-id", requestId);

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
          response.cookies.set(name, value, {
            ...options,
            secure: process.env.NODE_ENV === "production",
          });
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
    const redirect = NextResponse.redirect(redirectUrl);
    redirect.headers.set("x-request-id", requestId);
    return redirect;
  }

  response.headers.set("x-request-id", requestId);

  // Bind the requestId to request-scoped storage so any logger call within the
  // request (including the audit worker path) carries it automatically.
  return withRequestId(requestId, () => response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|auth/callback|docs|404|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css|txt|xml|map)$).*)",
  ],
};
