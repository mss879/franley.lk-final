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
  !v || /YOUR-PROJECT-REF|your-anon|your-service|re_your_api_key|yourdomain|your-merchant/i.test(v);

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
      hint: "Server-only. Checkout places every order with it (without it nobody can order), and it sends order emails, records PayHere card payments and makes refunds from the admin.",
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
    {
      key: "PAYHERE_MERCHANT_ID",
      ok: /^\d+$/.test(process.env.PAYHERE_MERCHANT_ID?.trim() ?? ""),
      required: false,
      hint: "PayHere → Integrations → Merchant ID. Without it and the secret, checkout offers cash on delivery and bank transfer only.",
    },
    {
      key: "PAYHERE_MERCHANT_SECRET",
      ok: !isPlaceholder(process.env.PAYHERE_MERCHANT_SECRET),
      required: false,
      hint: "Server-only. PayHere → Integrations → the Merchant Secret shown against your approved domain.",
    },
    {
      key: "PAYHERE_MODE",
      ok: ["", "sandbox", "live"].includes(process.env.PAYHERE_MODE?.trim().toLowerCase() ?? ""),
      required: false,
      hint: "sandbox or live. Anything else is treated as sandbox — set live in production.",
    },
    {
      key: "PAYHERE_APP_ID / PAYHERE_APP_SECRET",
      ok: Boolean(process.env.PAYHERE_APP_ID?.trim() && process.env.PAYHERE_APP_SECRET?.trim()),
      required: false,
      hint: "Optional. PayHere → Settings → API Keys. Lets the store look up a payment whose notification was missed, and refund from the admin. On live, PayHere must whitelist this server's IP (support@payhere.lk).",
    },
    {
      key: "RESEND_REPLY_TO / ORDER_NOTIFICATION_EMAIL",
      ok: Boolean(process.env.RESEND_REPLY_TO && process.env.ORDER_NOTIFICATION_EMAIL),
      required: false,
      hint: "Optional. Where customer replies land and who gets the new-order alert. Both default to the store email.",
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
  const isProd = process.env.NODE_ENV === "production";

  if (missing.length) {
    const lines = missing.map((c) => `  • ${c.key} — ${c.hint}`).join("\n");
    console.warn(
      `\n[franley] ${missing.length} environment variable(s) not set${isProd ? " IN PRODUCTION" : ""}:\n${lines}\n`,
    );
  }

  const supabaseConfigured = checks
    .filter((c) => c.key === "NEXT_PUBLIC_SUPABASE_URL" || c.key === "NEXT_PUBLIC_SUPABASE_ANON_KEY")
    .every((c) => c.ok);
  if (supabaseConfigured && isPlaceholder(process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    console.error("[franley] SUPABASE_SERVICE_ROLE_KEY is not set — checkout cannot place orders.");
  }

  // Combinations that look configured but would quietly lose card payments.
  const payhere = Boolean(process.env.PAYHERE_MERCHANT_ID?.trim() && process.env.PAYHERE_MERCHANT_SECRET?.trim());
  if (payhere && isPlaceholder(process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    console.error("[franley] PayHere is configured but SUPABASE_SERVICE_ROLE_KEY is not — card payments will be taken but never recorded.");
  }
  if (isProd && payhere && process.env.PAYHERE_MODE?.trim().toLowerCase() !== "live") {
    console.error("[franley] PayHere is in SANDBOX mode in production. Set PAYHERE_MODE=live to take real payments.");
  }
  if (isProd && process.env.PAYHERE_NOTIFY_URL?.trim()) {
    console.error("[franley] PAYHERE_NOTIFY_URL is set in production. It is for local tunnel testing only — remove it.");
  }
}

export const siteUrl = () =>
  (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://franley.lk");
