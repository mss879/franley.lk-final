import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { siteUrl } from "@/lib/env";

/**
 * PayHere (payhere.lk) — Checkout API.
 *
 * The shopper is sent to PayHere's hosted page by a signed form POST, pays
 * there, and comes back to /order/<number>. Card details never touch this
 * server. PayHere tells us the outcome with a server-to-server POST to
 * /api/payments/payhere/notify, signed with `md5sig`; nothing the browser says
 * on the way back is trusted.
 *
 * Reference: https://support.payhere.lk/api-&-mobile-sdk/checkout-api
 *
 * LIVE ONLY. This store has no sandbox account, so there is no mode switch:
 * every request goes to PayHere's live system.
 *
 * Going live (see DEPLOY.md §2b):
 *   1. franley.lk added under Integrations in the LIVE account and approved;
 *      PAYHERE_MERCHANT_SECRET is the secret shown against that domain.
 *   2. NEXT_PUBLIC_SITE_URL=https://franley.lk (or unset — it falls back to
 *      that): the return, cancel and notify URLs are built from it.
 *      PAYHERE_NOTIFY_URL unset.
 *   3. /api/payments/payhere/notify reachable from the internet (the proxy
 *      matcher skips api/payments/; the CSP form-action allows www.payhere.lk).
 *   4. SUPABASE_SERVICE_ROLE_KEY set — recording a payment needs it.
 *   5. Optional Merchant API (lookup + refunds): PAYHERE_APP_ID/SECRET from the
 *      LIVE account, and this server's outbound IP whitelisted by
 *      support@payhere.lk. Without that PayHere refuses those calls; nothing
 *      breaks — the notify call stays the source of truth and refunds are made
 *      in the PayHere dashboard instead.
 *   6. Migration 0012 applied. Place one small real order, then refund it.
 */

/** PayHere's live system. The `www` is required — without it PayHere answers PH-0022. */
const PAYHERE_HOST = "https://www.payhere.lk";

type Config = {
  merchantId: string;
  merchantSecret: string;
  host: string;
  appId: string | null;
  appSecret: string | null;
};

function config(): Config | null {
  const merchantId = process.env.PAYHERE_MERCHANT_ID?.trim();
  const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET?.trim();
  if (!merchantId || !merchantSecret) return null;

  return {
    merchantId,
    merchantSecret,
    host: PAYHERE_HOST,
    appId: process.env.PAYHERE_APP_ID?.trim() || null,
    appSecret: process.env.PAYHERE_APP_SECRET?.trim() || null,
  };
}

/** True when the merchant id and secret are set. Card checkout is hidden without them. */
export function payhereEnabled() {
  return config() !== null;
}

const md5Upper = (s: string) => createHash("md5").update(s, "utf8").digest("hex").toUpperCase();

/** Integer cents to PayHere's "1000.00". String arithmetic — no float ever touches money. */
export function formatAmount(cents: number) {
  return `${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

/** PayHere's "1000.00" (or "1000") back to integer cents. Null if it is not a plain amount. */
export function amountToCents(amount: string): number | null {
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(amount.trim());
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

/** PayHere rejects payloads carrying markup or emoji ("Something Went Wrong"). */
const clean = (v: string, max: number) =>
  v.replace(/[<>]/g, "").replace(/\p{Extended_Pictographic}/gu, "").replace(/\s+/g, " ").trim().slice(0, max);

export type PayableOrder = {
  orderNumber: string;
  totalCents: number;
  currency: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  /** The order-page credential. Round-tripped through PayHere so the shopper lands back on their order. */
  accessToken: string | null;
};

export type PayHereCheckout = { action: string; fields: Record<string, string> };

/**
 * Everything the browser needs to POST to PayHere. The hash is made here, on
 * the server, because it is keyed with the merchant secret.
 */
export function buildCheckout(order: PayableOrder): PayHereCheckout | null {
  const cfg = config();
  if (!cfg) return null;

  const amount = formatAmount(order.totalCents);
  const currency = order.currency.trim().toUpperCase();
  const hash = md5Upper(cfg.merchantId + order.orderNumber + amount + currency + md5Upper(cfg.merchantSecret));

  const site = siteUrl();
  const orderUrl = (state: string) => {
    const q = new URLSearchParams();
    if (order.accessToken) q.set("token", order.accessToken);
    q.set("payment", state);
    return `${site}/order/${encodeURIComponent(order.orderNumber)}?${q}`;
  };

  const [first, ...rest] = clean(order.customerName, 120).split(" ");
  const address = clean([order.addressLine1, order.addressLine2].filter(Boolean).join(", "), 250);
  const city = clean(order.city, 100);

  return {
    action: `${cfg.host}/pay/checkout`,
    fields: {
      merchant_id: cfg.merchantId,
      return_url: orderUrl("return"),
      cancel_url: orderUrl("cancelled"),
      // Must be reachable from the internet. PAYHERE_NOTIFY_URL lets a tunnel
      // (ngrok, cloudflared) stand in for localhost when testing locally.
      notify_url: process.env.PAYHERE_NOTIFY_URL?.trim() || `${site}/api/payments/payhere/notify`,
      order_id: order.orderNumber,
      items: `Franley order ${order.orderNumber}`,
      currency,
      amount,
      first_name: first || "Customer",
      last_name: rest.join(" ") || first || "Customer",
      email: order.customerEmail.trim(),
      phone: order.customerPhone.replace(/[^\d+]/g, ""),
      address,
      city,
      country: "Sri Lanka",
      delivery_address: address,
      delivery_city: city,
      delivery_country: "Sri Lanka",
      // Comes back on the notify call, where it builds the "track your order"
      // link in the confirmation email. It is re-verified there, not trusted.
      custom_1: order.accessToken ?? "",
      hash,
    },
  };
}

/** PayHere's status_code, mapped onto orders.payment_status. */
const STATUS = {
  "2": "paid",
  "0": "pending",
  "-1": "failed", // cancelled by the shopper
  "-2": "failed",
  "-3": "refunded", // charged back
} as const;

export type GatewayStatus = (typeof STATUS)[keyof typeof STATUS];

export type PayHereNotification = {
  orderNumber: string;
  paymentId: string | null;
  status: GatewayStatus;
  statusCode: string;
  amountCents: number;
  currency: string;
  method: string | null;
  message: string | null;
  custom1: string | null;
};

/**
 * Verifies a notify POST and returns it parsed, or a reason it was refused.
 * The signature check is the whole security of card payments: without it
 * anyone who can guess an order number could mark it paid.
 */
export function verifyNotification(
  params: Record<string, string>,
): { ok: true; notification: PayHereNotification } | { ok: false; reason: string } {
  const cfg = config();
  if (!cfg) return { ok: false, reason: "payhere-not-configured" };

  const { merchant_id, order_id, payhere_amount, payhere_currency, status_code, md5sig } = params;
  if (!merchant_id || !order_id || !payhere_amount || !payhere_currency || !status_code || !md5sig) {
    return { ok: false, reason: "missing-params" };
  }
  if (merchant_id !== cfg.merchantId) return { ok: false, reason: "wrong-merchant" };

  const expected = Buffer.from(
    md5Upper(merchant_id + order_id + payhere_amount + payhere_currency + status_code + md5Upper(cfg.merchantSecret)),
  );
  const given = Buffer.from(md5sig.trim().toUpperCase());
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: "bad-signature" };
  }

  const status = STATUS[status_code as keyof typeof STATUS];
  if (!status) return { ok: false, reason: `unknown-status-${status_code}` };

  const amountCents = amountToCents(payhere_amount);
  if (amountCents === null) return { ok: false, reason: "bad-amount" };

  // md5sig does not cover payment_id, method or status_message: whoever holds
  // a genuine notification can replay it with those changed. Keep them to the
  // shapes PayHere sends, so they are at worst wrong, never markup or a pattern.
  const paymentId = params.payment_id?.trim() ?? "";
  const method = params.method?.trim() ?? "";
  return {
    ok: true,
    notification: {
      orderNumber: order_id,
      paymentId: /^[A-Za-z0-9-]{1,40}$/.test(paymentId) ? paymentId : null,
      status,
      statusCode: status_code,
      amountCents,
      currency: payhere_currency.toUpperCase(),
      method: /^[A-Za-z0-9_ -]{1,30}$/.test(method) ? method : null,
      message: params.status_message ? params.status_message.replace(/\p{Cc}/gu, " ").trim().slice(0, 200) || null : null,
      custom1: params.custom_1 || null,
    },
  };
}

// ---- Retrieval API ---------------------------------------------------------
//
// Optional. With an App ID and App Secret (PayHere → Settings → API Keys) the
// store can ASK PayHere whether an order was paid, instead of only waiting to
// be told. That covers a notify call that never arrived — and it is the only
// way a payment is ever recorded on localhost, which PayHere cannot reach.

let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(cfg: Config): Promise<string | null> {
  if (!cfg.appId || !cfg.appSecret) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const res = await fetch(`${cfg.host}/merchant/v1/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${cfg.appId}:${cfg.appSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    console.error("payhere token request failed", res.status);
    return null;
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) return null;

  // Tokens last ~10 minutes; renew a minute early.
  cachedToken = { value: json.access_token, expiresAt: Date.now() + Math.max(0, (json.expires_in ?? 0) - 60) * 1000 };
  return cachedToken.value;
}

export function payhereLookupEnabled() {
  const cfg = config();
  return Boolean(cfg?.appId && cfg.appSecret);
}

export type RetrievedPayment = {
  paymentId: string;
  amountCents: number;
  currency: string;
  method: string | null;
};

/**
 * The successful payment PayHere holds for this order, if any. PayHere does not
 * enforce unique order ids, so only a RECEIVED payment of exactly the expected
 * amount counts.
 */
type SearchRow = {
  payment_id?: number | string;
  order_id?: string;
  status?: string;
  currency?: string;
  amount?: number;
  payment_method?: { method?: string } | null;
};

/**
 * Every successful payment PayHere holds under this order id — including ones
 * since refunded or charged back. Null when the lookup itself failed (no
 * credentials, network, refused); [] when PayHere has none.
 */
async function searchPayments(orderNumber: string): Promise<SearchRow[] | null> {
  const cfg = config();
  if (!cfg) return null;
  const token = await accessToken(cfg);
  if (!token) return null;

  const res = await fetch(
    `${cfg.host}/merchant/v1/payment/search?order_id=${encodeURIComponent(orderNumber)}`,
    {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    },
  );
  if (res.status === 401) cachedToken = null;
  if (!res.ok) {
    console.error("payhere payment search failed", res.status);
    return null;
  }

  const json = (await res.json()) as { status?: number; data?: SearchRow[] | null };
  // -1 is PayHere's "No payments found" — an answer, not a failure.
  if (json.status === -1) return [];
  if (json.status !== 1 || !Array.isArray(json.data)) return null;
  return json.data;
}

export async function findReceivedPayment(
  orderNumber: string,
  expectedCents: number,
  expectedCurrency: string,
): Promise<RetrievedPayment | null> {
  const rows = await searchPayments(orderNumber);
  if (!rows) return null;

  for (const p of rows) {
    if (p.order_id !== orderNumber || p.status !== "RECEIVED" || p.payment_id == null) continue;
    const cents = typeof p.amount === "number" ? Math.round(p.amount * 100) : null;
    const currency = (p.currency ?? "").toUpperCase();
    if (cents !== expectedCents || currency !== expectedCurrency.toUpperCase()) continue;
    return { paymentId: String(p.payment_id), amountCents: cents, currency, method: p.payment_method?.method ?? null };
  }
  return null;
}

// ---- Refund API ------------------------------------------------------------
//
// Same OAuth token and the same Merchant API permission as the Retrieval API.
// https://support.payhere.lk/api-&-mobile-sdk/refund-api

export function payhereRefundEnabled() {
  return payhereLookupEnabled();
}

/**
 * What PayHere says about one payment right now: RECEIVED, REFUND REQUESTED,
 * REFUND PROCESSING, REFUNDED or CHARGEBACKED. Read before refunding, so a
 * refund whose answer was lost (a timeout) is never sent a second time.
 * "unknown" means the lookup failed; "missing" that PayHere has no such payment.
 */
export async function paymentState(orderNumber: string, paymentId: string): Promise<string> {
  try {
    const rows = await searchPayments(orderNumber);
    if (!rows) return "unknown";
    const row = rows.find((p) => String(p.payment_id) === paymentId);
    return row?.status?.toUpperCase() ?? "missing";
  } catch {
    return "unknown";
  }
}

export type RefundResult =
  | { ok: true; refundNumber: string }
  | {
      ok: false;
      /**
       * "unknown": the request may have reached PayHere and been processed —
       * never tell anyone "nothing was refunded" in that case.
       */
      code: "not-configured" | "access-denied" | "auth" | "rate-limited" | "declined" | "unknown";
      message: string;
    };

/**
 * Refunds a PayHere payment. Full refund unless `amountCents` is given — the
 * admin only offers full refunds, because orders.payment_status has no
 * "partly refunded" state to record the rest in.
 */
export async function refundPayment(
  paymentId: string,
  description: string,
  amountCents?: number,
): Promise<RefundResult> {
  const cfg = config();
  if (!cfg || !cfg.appId || !cfg.appSecret) {
    return { ok: false, code: "not-configured", message: "PAYHERE_APP_ID and PAYHERE_APP_SECRET are not set." };
  }

  let token: string | null;
  try {
    token = await accessToken(cfg);
  } catch {
    // Nothing was sent to the refund endpoint yet, so this one IS safe to retry.
    return { ok: false, code: "declined", message: "Could not reach PayHere to sign in. Nothing was refunded — try again." };
  }
  if (!token) {
    return { ok: false, code: "auth", message: "PayHere did not accept the App ID and App Secret." };
  }

  let res: Response;
  try {
    res = await fetch(`${cfg.host}/merchant/v1/payment/refund`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        payment_id: paymentId,
        description: clean(description, 100) || "Refund",
        ...(amountCents != null ? { amount: formatAmount(amountCents) } : {}),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    // A timeout or a dropped connection AFTER the request left: PayHere may
    // well have refunded it. Only the dashboard (or paymentState) can say.
    return {
      ok: false,
      code: "unknown",
      message: "PayHere did not answer in time, so the refund may or may not have gone through. Check this payment in the PayHere dashboard before trying again.",
    };
  }

  if (res.status === 429) {
    return { ok: false, code: "rate-limited", message: "PayHere is limiting requests from this server. Wait a few seconds and try again." };
  }

  const json = (await res.json().catch(() => null)) as
    | { status?: number; msg?: string; data?: unknown; error?: string; error_description?: string }
    | null;

  if (res.ok && json === null) {
    return {
      ok: false,
      code: "unknown",
      message: "PayHere's answer could not be read, so the refund may or may not have gone through. Check this payment in the PayHere dashboard before trying again.",
    };
  }
  if (json?.error === "invalid_token") cachedToken = null;
  if (res.status === 401 || /access denied/i.test(json?.msg ?? "")) {
    return {
      ok: false,
      code: "access-denied",
      message: "PayHere refused this server — on the live account the API key's domain and this server's IP must be whitelisted.",
    };
  }
  if (json?.status === -2 || json?.error === "invalid_token") {
    cachedToken = null;
    return { ok: false, code: "auth", message: "PayHere rejected the API credentials." };
  }
  if (json?.status === 1) {
    return { ok: true, refundNumber: json.data == null ? "" : String(json.data) };
  }
  return { ok: false, code: "declined", message: json?.msg?.trim() || `PayHere did not process the refund (HTTP ${res.status}).` };
}
