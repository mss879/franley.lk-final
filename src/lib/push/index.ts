import "server-only";
import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/server";
import { SITE } from "@/lib/constants";
import { formatPrice } from "@/lib/utils";
import type { EmailOrder } from "@/lib/email/templates";

/**
 * New-order alerts on the admin's phone, by Web Push.
 *
 * Each device that turned alerts on (Admin → Settings) has a row in
 * admin_push_subscriptions (0017_push_notifications.sql). Sending is a signed
 * HTTPS POST to that device's push service — Apple's for an iPhone, Google's
 * for Chrome — encrypted with the device's own keys. The signing key pair is
 * VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (`npm run vapid-keys` makes one).
 *
 * On an iPhone this only works once the admin is added to the Home Screen and
 * opened from there: iOS gives push to installed web apps only.
 */

export type PushMessage = {
  title: string;
  body: string;
  /** Opened when the notification is tapped. Always a path inside /admin. */
  url: string;
  /** Notifications with the same tag replace each other instead of stacking. */
  tag?: string;
};

type Subscription = { id: string; endpoint: string; p256dh: string; auth: string };

function vapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  // Apple refuses a push whose subject is not a mailto: or https: address.
  const subject = process.env.VAPID_SUBJECT?.trim() || `mailto:${SITE.email}`;
  return { publicKey, privateKey, subject };
}

/** True when the VAPID keys are set. Without them the settings card says so. */
export function pushEnabled() {
  return vapid() !== null;
}

/** The public half, handed to the browser so it can subscribe. Not a secret. */
export function pushPublicKey() {
  return vapid()?.publicKey ?? null;
}

/**
 * Sends one message to the given subscriptions. Never throws. A subscription
 * the push service says is gone (the app was deleted, alerts were turned off
 * in iOS Settings) is removed, so it is not retried on every order.
 */
export async function sendToSubscriptions(subs: Subscription[], message: PushMessage) {
  const keys = vapid();
  if (!keys || !subs.length) return { sent: 0, failed: 0 };

  const supabase = createServiceClient();
  const payload = JSON.stringify(message);

  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
        vapidDetails: keys,
        // An order alert is worth delivering late (phone off overnight), but
        // not days late.
        TTL: 60 * 60 * 24,
        urgency: "high",
        // The standard encoding, and the only one Apple's push service takes.
        contentEncoding: "aes128gcm",
        timeout: 10_000,
      }),
    ),
  );

  let sent = 0;
  let failed = 0;
  const gone: string[] = [];
  const now = new Date().toISOString();

  await Promise.all(
    results.map(async (r, i) => {
      const sub = subs[i];
      if (r.status === "fulfilled") {
        sent++;
        await supabase.from("admin_push_subscriptions").update({ last_success_at: now, last_error: null }).eq("id", sub.id);
        return;
      }
      failed++;
      const err = r.reason as { statusCode?: number; body?: string; message?: string };
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        gone.push(sub.id);
        return;
      }
      const reason = `${err?.statusCode ?? ""} ${err?.body || err?.message || String(r.reason)}`.trim();
      console.error("push send failed", { endpoint: new URL(sub.endpoint).host, reason });
      await supabase.from("admin_push_subscriptions").update({ last_error: reason.slice(0, 500) }).eq("id", sub.id);
    }),
  );

  if (gone.length) await supabase.from("admin_push_subscriptions").delete().in("id", gone);
  return { sent, failed };
}

/** Every device of every admin who is still an admin. */
async function activeAdminSubscriptions(): Promise<Subscription[]> {
  const supabase = createServiceClient();
  const [{ data: subs, error }, { data: admins, error: adminError }] = await Promise.all([
    supabase.from("admin_push_subscriptions").select("id, user_id, endpoint, p256dh, auth"),
    supabase.from("admin_users").select("user_id").eq("is_active", true).is("revoked_at", null),
  ]);
  if (error || adminError) {
    // 42P01 = the table is missing: 0017_push_notifications.sql has not been run.
    if (error?.code !== "42P01") console.error("could not load push subscriptions", error ?? adminError);
    return [];
  }
  const active = new Set((admins ?? []).map((a) => a.user_id as string));
  return (subs ?? []).filter((s) => active.has(s.user_id as string)) as Subscription[];
}

const METHOD: Record<EmailOrder["payment_method"], string> = {
  cod: "Cash on delivery",
  bank_transfer: "Bank transfer",
  card: "Paid by card",
};

/**
 * "New order" on every admin device, at most once per order — called next to
 * the confirmation emails, so after checkout for cash and bank transfer and
 * once PayHere confirms the money for a card order. Never throws: the order
 * is already placed by the time this runs.
 */
export async function sendNewOrderPush(order: EmailOrder, orderId: string, opts?: { paidAfterCancel?: boolean }) {
  if (!pushEnabled()) return;
  try {
    const subs = await activeAdminSubscriptions();
    if (!subs.length) return;

    const supabase = createServiceClient();
    // Claim first, then send — a retried checkout or a repeated PayHere
    // notification loses this insert and sends nothing.
    const { error: claimError } = await supabase.from("admin_push_log").insert({ order_id: orderId });
    if (claimError) {
      if (claimError.code !== "23505") console.error("push claim failed", claimError);
      return;
    }

    const pieces = order.items.reduce((n, i) => n + i.quantity, 0);
    const where = [order.shipping_city, order.shipping_district].filter(Boolean).join(", ");
    const message: PushMessage = opts?.paidAfterCancel
      ? {
          title: `Paid after cancelling · ${order.order_number}`,
          body: `${order.customer_name} paid ${formatPrice(order.total_cents)} by card for a cancelled order. Refund it from the order page.`,
          url: `/admin/orders/${orderId}`,
          tag: `order-${order.order_number}`,
        }
      : {
          title: `New order · ${formatPrice(order.total_cents)}`,
          body: `${order.order_number} from ${order.customer_name}${where ? `, ${where}` : ""} · ${pieces} piece${pieces === 1 ? "" : "s"} · ${METHOD[order.payment_method]}`,
          url: `/admin/orders/${orderId}`,
          tag: `order-${order.order_number}`,
        };

    const { sent, failed } = await sendToSubscriptions(subs, message);
    await supabase.from("admin_push_log").update({ sent_count: sent, failed_count: failed }).eq("order_id", orderId);
  } catch (err) {
    console.error("new-order push failed", err);
  }
}
