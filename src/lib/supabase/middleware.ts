import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { sessionCookieOptions } from "./cookie-options";

/**
 * Refreshes the auth cookie on every request and gates /admin.
 * getUser() is deliberate — getSession() trusts the cookie without
 * revalidating it against the auth server, which is not safe for a gate.
 */
function isConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return Boolean(url && !url.includes("YOUR-PROJECT-REF") && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Before the client has wired up their project, the storefront must still
  // render. /admin stays unreachable rather than falling open.
  if (!isConfigured()) {
    if (request.nextUrl.pathname.startsWith("/admin") && request.nextUrl.pathname !== "/admin/login") {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("error", "not-configured");
      return NextResponse.redirect(url);
    }
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: sessionCookieOptions,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  // Signed in is all this checks. /admin/verify (the emailed-code step) is
  // reachable for any signed-in user; whether they are an admin and whether
  // this session has entered its code is decided by requireAdmin() and, for
  // the data itself, by is_admin() in the database (0022_admin_email_2fa.sql).
  // A signed-in visitor to /admin/login goes to /admin, which forwards an
  // unverified admin to /admin/verify — where "sign out" lets them switch.
  const isAdminArea = pathname.startsWith("/admin");
  const isLoginPage = pathname === "/admin/login";

  if (isAdminArea && !isLoginPage && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isLoginPage && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
