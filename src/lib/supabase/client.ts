"use client";

import { createBrowserClient } from "@supabase/ssr";
import { sessionCookieOptions } from "./cookie-options";

/** Browser client — anon key only. Every read it can do is RLS-gated. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions: sessionCookieOptions },
  );
}
