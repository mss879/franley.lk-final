import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { sessionCookieOptions } from "./cookie-options";

/**
 * Server client bound to the request cookie jar, so the admin session is
 * visible to Server Components, Route Handlers and Server Actions.
 * Must be awaited — cookies() is async in Next 15+.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: sessionCookieOptions,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // The middleware refreshes the session instead, so this is safe.
          }
        },
      },
    },
  );
}

/**
 * Anon-key client with no cookie jar, for public reads that must not depend on
 * who is asking — site settings, say. Not calling cookies() keeps the pages
 * that use it statically renderable; RLS still applies exactly as for a
 * signed-out shopper.
 */
export function createAnonClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

/**
 * Service-role client. NEVER import this into anything that ships to the
 * browser — it bypasses RLS entirely. Server-only, and only where a request
 * genuinely must act outside the caller's permissions.
 */
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}
