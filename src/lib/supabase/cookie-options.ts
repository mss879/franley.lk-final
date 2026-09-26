/**
 * The admin session cookie is marked Secure whenever the site is served over
 * HTTPS — always, in production: NEXT_PUBLIC_SITE_URL is https there, or unset
 * and falling back to https://franley.lk as in src/lib/env.ts — so it never
 * travels over plain HTTP. Local development on http://localhost leaves it off:
 * Safari drops Secure cookies there and signing in would silently fail.
 */
export const sessionCookieOptions = {
  secure: (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://franley.lk").startsWith("https://"),
};
