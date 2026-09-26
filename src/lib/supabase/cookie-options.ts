/**
 * The admin session cookie is marked Secure whenever the site is served over
 * HTTPS — always, in production (next.config.ts refuses a production build
 * without an https NEXT_PUBLIC_SITE_URL) — so it never travels over plain HTTP.
 * Local development on http://localhost leaves it off: Safari drops Secure
 * cookies there and signing in would silently fail.
 */
export const sessionCookieOptions = {
  secure: (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://"),
};
