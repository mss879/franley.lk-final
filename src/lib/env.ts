import "server-only";

/**
 * Environment validation.
 *
 * Deliberately NOT a hard throw at import time. A shop that refuses to boot
 * because an optional email key is missing is worse than one that boots and
 * skips email — but a shop that boots with a *broken* Supabase URL and silently
 * serves seed data forever is worse than both. So: report loudly, fail only on
 * what genuinely cannot be worked around.
 */

type Check = { key: string; ok: boolean; required: boolean; hint: string };

const isPlaceholder = (v?: string) =>
  !v || /YOUR-PROJECT-REF|your-anon|your-service|re_your_api_key|yourdomain/i.test(v);

export function checkEnv(): Check[] {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  return [
    {
      key: "NEXT_PUBLIC_SUPABASE_URL",
      ok: !isPlaceholder(url) && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url ?? ""),
      required: false,
      hint: "Supabase → Project Settings → API → Project URL. Without it the store serves the bundled seed catalogue.",
    },
    {
      key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      ok: !isPlaceholder(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      required: false,
      hint: "Supabase → Project Settings → API → anon public key.",
    },
    {
      key: "SUPABASE_SERVICE_ROLE_KEY",
      ok: !isPlaceholder(process.env.SUPABASE_SERVICE_ROLE_KEY),
      required: false,
      hint: "Server-only. Needed for order confirmation emails, which read the order back past RLS.",
    },
    {
      key: "NEXT_PUBLIC_SITE_URL",
      ok: /^https?:\/\//.test(process.env.NEXT_PUBLIC_SITE_URL ?? ""),
      required: false,
      hint: "https://franley.lk in production. Canonical URLs, sitemap and email links are built from it.",
    },
    {
      key: "RESEND_API_KEY",
      ok: !isPlaceholder(process.env.RESEND_API_KEY),
      required: false,
      hint: "resend.com/api-keys. Without it no order emails are sent — checkout still works.",
    },
    {
      key: "RESEND_FROM_EMAIL",
      ok: Boolean(process.env.RESEND_FROM_EMAIL?.includes("@")),
      required: false,
      hint: "Must be on a domain verified in Resend, e.g. 'Franley <orders@franley.lk>'.",
    },
  ];
}

/**
 * Called once from the root layout. Logs a single readable block at boot so a
 * misconfigured deploy is obvious in the platform logs rather than discovered
 * by a customer.
 */
let reported = false;
export function reportEnv() {
  if (reported) return;
  // The build prerenders pages in several workers, each of which would print
  // this. Only worth saying at runtime, where it means a live misconfiguration.
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  reported = true;

  const checks = checkEnv();
  const missing = checks.filter((c) => !c.ok);
  if (!missing.length) return;

  const isProd = process.env.NODE_ENV === "production";
  const lines = missing.map((c) => `  • ${c.key} — ${c.hint}`).join("\n");
  console.warn(
    `\n[franley] ${missing.length} environment variable(s) not set${isProd ? " IN PRODUCTION" : ""}:\n${lines}\n`,
  );
}

export const siteUrl = () =>
  (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://franley.lk");
