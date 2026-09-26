import "server-only";
import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase/server";
import { SITE } from "@/lib/constants";
import { getSiteSettings } from "@/lib/settings";
import * as templates from "./templates";
import type { EmailOrder } from "./templates";

export type EmailKind =
  | "contact_enquiry"
  | "order_confirmation"
  | "order_admin_alert"
  | "order_shipped"
  | "order_delivered"
  | "order_cancelled";

function config() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return null;
  return {
    apiKey,
    from,
    replyTo: process.env.RESEND_REPLY_TO || SITE.email,
    adminTo: (process.env.ORDER_NOTIFICATION_EMAIL || SITE.email)
      .split(",").map((s) => s.trim()).filter(Boolean),
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? SITE.url,
  };
}

/** True when Resend is wired up. The storefront works fine without it. */
export function emailEnabled() {
  return config() !== null;
}

/**
 * Send one transactional email, at most once per (order, kind).
 *
 * The row in email_log is CLAIMED before Resend is called, not after. A unique
 * index on (order_id, kind) means a concurrent or retried send loses the insert
 * and returns without emailing. Doing it the other way round — send, then
 * record — would put duplicates in a customer's inbox every time a request was
 * retried, which is the failure people actually notice.
 */
async function sendOnce(opts: {
  orderId: string | null;
  kind: EmailKind;
  to: string[];
  subject: string;
  html: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const cfg = config();
  if (!cfg) return { sent: false, reason: "resend-not-configured" };
  if (!opts.to.length) return { sent: false, reason: "no-recipient" };

  const supabase = createServiceClient();

  const { data: claim, error: claimError } = await supabase
    .from("email_log")
    .insert({
      order_id: opts.orderId,
      kind: opts.kind,
      recipient: opts.to[0],
      subject: opts.subject,
      status: "pending",
      attempts: 1,
    })
    .select("id")
    .single();

  if (claimError) {
    // 23505 = the unique index fired, so this email already went out.
    if (claimError.code === "23505") return { sent: false, reason: "already-sent" };
    console.error("email_log claim failed", claimError);
    return { sent: false, reason: "claim-failed" };
  }

  try {
    const resend = new Resend(cfg.apiKey);
    const { data, error } = await resend.emails.send({
      from: cfg.from,
      to: opts.to,
      replyTo: cfg.replyTo,
      subject: opts.subject,
      html: opts.html,
    });
    if (error) throw new Error(error.message);

    await supabase
      .from("email_log")
      .update({ status: "sent", provider_id: data?.id ?? null, sent_at: new Date().toISOString() })
      .eq("id", claim.id);

    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`email ${opts.kind} failed`, message);
    await supabase
      .from("email_log")
      .update({ status: "failed", error: message.slice(0, 2000) })
      .eq("id", claim.id);
    return { sent: false, reason: message };
  }
}

const trackUrl = (order: EmailOrder, token: string | null, siteUrl: string) =>
  token
    ? `${siteUrl}/order/${encodeURIComponent(order.order_number)}?token=${encodeURIComponent(token)}`
    : `${siteUrl}/contact`;

/**
 * Reads an order back in the shape the templates want. Uses the service client
 * because `anon` deliberately has no SELECT on orders — see 0005_orders.sql.
 * Nothing from this read is returned to the browser.
 */
export async function loadOrderForEmail(orderId: string): Promise<EmailOrder | null> {
  const { data, error } = await createServiceClient()
    .from("orders")
    .select(
      "order_number, customer_name, customer_email, customer_phone, payment_method," +
      "subtotal_cents, shipping_cents, discount_cents, total_cents," +
      "shipping_line1, shipping_line2, shipping_city, shipping_district, shipping_postal_code," +
      "customer_note, tracking_number," +
      "items:order_items(product_title, variant_label, quantity, unit_price_cents)",
    )
    .eq("id", orderId)
    .single();

  if (error || !data) {
    console.error("could not load order for email", error);
    return null;
  }
  return data as unknown as EmailOrder;
}

/**
 * Fired after checkout — or, for a card order, once PayHere confirms the money
 * (see src/lib/payhere/record.ts). Sends the customer their confirmation and
 * the shop its alert. Never throws — the order is already placed and paid for by the time
 * this runs, so an email problem must not surface as a failed checkout.
 */
export async function sendOrderPlacedEmails(
  order: EmailOrder,
  orderId: string,
  accessToken: string | null,
  opts?: { paidAfterCancel?: boolean },
) {
  const cfg = config();
  if (!cfg) return { customer: false, admin: false };

  // The order was cancelled (its stock already back on the shelf) before the
  // payment landed. Telling the customer "it is being prepared" would be false;
  // the shop has to refund it, so only the shop hears about it.
  if (opts?.paidAfterCancel) {
    const adminMail = templates.orderAdminAlert(order, `${cfg.siteUrl}/admin/orders`, {
      warning: "PAID AFTER CANCELLATION. This order was cancelled before the customer's card payment arrived. Refund the payment in PayHere (or from the order page) and let the customer know.",
    });
    const admin = await sendOnce({ orderId, kind: "order_admin_alert", to: cfg.adminTo, ...adminMail }).catch(() => null);
    return { customer: false, admin: Boolean(admin?.sent) };
  }

  const { bankTransferDetails, phone, whatsapp } = await getSiteSettings();
  const customerMail = templates.orderConfirmation(order, trackUrl(order, accessToken, cfg.siteUrl), {
    bankDetails: bankTransferDetails,
    contact: { phone, whatsapp },
  });
  const adminMail = templates.orderAdminAlert(order, `${cfg.siteUrl}/admin/orders`);

  const [customer, admin] = await Promise.allSettled([
    sendOnce({ orderId, kind: "order_confirmation", to: [order.customer_email], ...customerMail }),
    sendOnce({ orderId, kind: "order_admin_alert", to: cfg.adminTo, ...adminMail }),
  ]);

  return {
    customer: customer.status === "fulfilled" && customer.value.sent,
    admin: admin.status === "fulfilled" && admin.value.sent,
  };
}

/** Fired from the admin when an order's status changes. */
export async function sendOrderStatusEmail(
  order: EmailOrder,
  orderId: string,
  status: "shipped" | "delivered" | "cancelled",
  extra?: { accessToken?: string | null; reason?: string | null },
) {
  const cfg = config();
  if (!cfg) return { sent: false, reason: "resend-not-configured" };

  const { phone, whatsapp } = await getSiteSettings();
  const contact = { phone, whatsapp };
  const mail =
    status === "shipped"
      ? templates.orderShipped(order, trackUrl(order, extra?.accessToken ?? null, cfg.siteUrl), contact)
      : status === "delivered"
        ? templates.orderDelivered(order, contact)
        : templates.orderCancelled(order, extra?.reason, contact);

  const kind: EmailKind =
    status === "shipped" ? "order_shipped" : status === "delivered" ? "order_delivered" : "order_cancelled";

  return sendOnce({ orderId, kind, to: [order.customer_email], ...mail });
}

/**
 * The storefront contact form. Sent to the shop with the customer's address as
 * reply-to, so hitting Reply answers the customer directly.
 *
 * Not covered by the exactly-once index — that index is partial on order_id,
 * and a customer may legitimately write in more than once.
 */
export async function sendContactEnquiry(enquiry: templates.ContactEnquiry) {
  const cfg = config();
  if (!cfg) return { sent: false, reason: "resend-not-configured" as const };

  const mail = templates.contactEnquiry(enquiry);
  const supabase = createServiceClient();

  const { data: claim } = await supabase
    .from("email_log")
    .insert({
      order_id: null,
      kind: "contact_enquiry",
      recipient: cfg.adminTo[0],
      subject: mail.subject,
      status: "pending",
      attempts: 1,
    })
    .select("id")
    .single();

  try {
    const resend = new Resend(cfg.apiKey);
    const { data, error } = await resend.emails.send({
      from: cfg.from,
      to: cfg.adminTo,
      replyTo: enquiry.email,
      subject: mail.subject,
      html: mail.html,
    });
    if (error) throw new Error(error.message);

    if (claim) {
      await supabase.from("email_log")
        .update({ status: "sent", provider_id: data?.id ?? null, sent_at: new Date().toISOString() })
        .eq("id", claim.id);
    }
    return { sent: true as const };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("contact enquiry failed", message);
    if (claim) {
      await supabase.from("email_log")
        .update({ status: "failed", error: message.slice(0, 2000) })
        .eq("id", claim.id);
    }
    return { sent: false as const, reason: message };
  }
}
