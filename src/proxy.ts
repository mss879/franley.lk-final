import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next 16 renamed the middleware convention to `proxy`. Runs on every
 * non-asset request to refresh the Supabase auth cookie and gate /admin.
 */
export default async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except static assets and image files — and the payment
    // gateway's server-to-server callbacks, which carry no session to refresh.
    "/((?!_next/static|_next/image|favicon.ico|api/payments/|brand/|products/|editorial/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
