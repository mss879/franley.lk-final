import { shell, button, escapeHtml, P, LABEL, BRAND, SANS, FONT, type EmailContact } from "./layout";
import { formatPrice } from "@/lib/utils";
import { SITE } from "@/lib/constants";

export type EmailOrderItem = {
  product_title: string;
  variant_label?: string | null;
  quantity: number;
  unit_price_cents: number;
};

export type EmailOrder = {
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  payment_method: "cod" | "bank_transfer" | "card";
  subtotal_cents: number;
  shipping_cents: number;
  discount_cents: number;
  total_cents: number;
  shipping_line1: string;
  shipping_line2?: string | null;
  shipping_city: string;
  shipping_district?: string | null;
  shipping_postal_code?: string | null;
  customer_note?: string | null;
  tracking_number?: string | null;
  items: EmailOrderItem[];
};

const siteUrl = () =>
  (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? SITE.url);

const firstName = (full: string) => escapeHtml(full.trim().split(/\s+/)[0] ?? full);

function itemsTable(order: EmailOrder) {
  const rows = order.items
    .map(
      (i) => `<tr>
        <td style="padding:12px 0;border-bottom:1px solid ${BRAND.hairline};font-family:${SANS};font-size:14px;color:${BRAND.ink};">
          ${escapeHtml(i.product_title)}
          ${i.variant_label ? `<br><span style="font-size:12px;color:#8C8279;">${escapeHtml(i.variant_label)}</span>` : ""}
          <br><span style="font-size:12px;color:#8C8279;">Qty ${i.quantity}</span>
        </td>
        <td align="right" style="padding:12px 0;border-bottom:1px solid ${BRAND.hairline};font-family:${SANS};font-size:14px;color:${BRAND.ink};white-space:nowrap;">
          ${formatPrice(i.unit_price_cents * i.quantity)}
        </td>
      </tr>`,
    )
    .join("");

  const line = (label: string, value: string, strong = false) => `<tr>
      <td style="padding:${strong ? "14px 0 0" : "8px 0 0"};font-family:${strong ? FONT : SANS};font-size:${strong ? "18px" : "13px"};color:${strong ? BRAND.ink : BRAND.inkMuted};">${label}</td>
      <td align="right" style="padding:${strong ? "14px 0 0" : "8px 0 0"};font-family:${strong ? FONT : SANS};font-size:${strong ? "18px" : "13px"};color:${BRAND.ink};white-space:nowrap;">${value}</td>
    </tr>`;

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;">
    ${rows}
    ${line("Subtotal", formatPrice(order.subtotal_cents))}
    ${line("Delivery", order.shipping_cents === 0 ? "Free" : formatPrice(order.shipping_cents))}
    ${order.discount_cents > 0 ? line("Discount", "−" + formatPrice(order.discount_cents)) : ""}
    ${line("Total", formatPrice(order.total_cents), true)}
  </table>`;
}

function addressBlock(order: EmailOrder) {
  const parts = [
    order.customer_name,
    order.shipping_line1,
    order.shipping_line2,
    [order.shipping_city, order.shipping_district].filter(Boolean).join(", "),
    order.shipping_postal_code,
  ].filter(Boolean) as string[];

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;background:${BRAND.creamPanel};border-radius:12px;">
    <tr><td style="padding:18px 20px;">
      ${LABEL("Delivering to")}
      <div style="margin-top:8px;font-family:${SANS};font-size:13px;line-height:1.7;color:${BRAND.inkMuted};">
        ${parts.map(escapeHtml).join("<br>")}
      </div>
    </td></tr>
  </table>`;
}

const PAYMENT_NOTE: Record<EmailOrder["payment_method"], string> = {
  cod: "You will pay the courier in cash when your order arrives. Please have the exact amount ready if you can.",
  bank_transfer:
    "We will send our bank details in a follow-up message shortly. Your order is packed and dispatched once the transfer clears.",
  card: "Your card payment has been received.",
};

/** The bank-transfer note carries the account details once the owner has filled them in at /admin/settings. */
function paymentNote(order: EmailOrder, bankDetails: string | null | undefined) {
  if (order.payment_method !== "bank_transfer" || !bankDetails) return P(PAYMENT_NOTE[order.payment_method]);
  return `${P("Please transfer the total to the account below and send us the slip on WhatsApp, quoting your order number. Your order is packed and dispatched once the transfer clears.")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;background:${BRAND.creamPanel};border-radius:12px;">
      <tr><td style="padding:18px 20px;font-family:${SANS};font-size:13px;line-height:1.7;color:${BRAND.ink};">
        ${bankDetails.split("\n").map(escapeHtml).join("<br>")}
      </td></tr>
    </table>`;
}

/** To the customer, immediately after checkout. */
export function orderConfirmation(
  order: EmailOrder,
  trackUrl: string,
  opts?: { bankDetails?: string | null; contact?: EmailContact },
) {
  const body = `
    ${P(`Thank you, ${firstName(order.customer_name)}. We have your order and it is being prepared.`)}
    ${P(`Your order number is <strong style="color:${BRAND.ink};">${escapeHtml(order.order_number)}</strong>. Quote it if you need to reach us.`)}
    ${itemsTable(order)}
    ${addressBlock(order)}
    ${paymentNote(order, opts?.bankDetails)}
    ${button(trackUrl, "Track your order")}
    ${P(`Orders are processed within 1&ndash;2 business days. Colombo and suburbs usually arrive in 1&ndash;3 working days, other areas in 2&ndash;5.`)}
  `;

  return {
    subject: `Order ${order.order_number} confirmed — Franley`,
    html: shell({
      preheader: `We have your order. Total ${formatPrice(order.total_cents)}.`,
      heading: "Your order is confirmed",
      body,
      contact: opts?.contact,
    }),
  };
}

/** To the shop, immediately after checkout. Terse and scannable on a phone. */
export function orderAdminAlert(order: EmailOrder, adminUrl: string, opts?: { warning?: string }) {
  const body = `
    ${opts?.warning ? P(`<strong style="color:${BRAND.wine};">${escapeHtml(opts.warning)}</strong>`) : ""}
    ${P(`<strong style="color:${BRAND.ink};">${formatPrice(order.total_cents)}</strong> &middot; ${order.items.reduce((n, i) => n + i.quantity, 0)} item(s) &middot; ${order.payment_method === "cod" ? "Cash on delivery" : order.payment_method === "bank_transfer" ? "Bank transfer" : "Card"}`)}
    ${itemsTable(order)}
    ${addressBlock(order)}
    ${P(`${escapeHtml(order.customer_name)}<br>
        <a href="tel:${escapeHtml(order.customer_phone.replace(/[^0-9+]/g, ""))}" style="color:${BRAND.wine};">${escapeHtml(order.customer_phone)}</a><br>
        <a href="mailto:${escapeHtml(order.customer_email)}" style="color:${BRAND.wine};">${escapeHtml(order.customer_email)}</a>`)}
    ${order.customer_note ? P(`<strong style="color:${BRAND.ink};">Customer note:</strong> ${escapeHtml(order.customer_note)}`) : ""}
    ${button(adminUrl, "Open in admin")}
  `;

  return {
    subject: `${opts?.warning ? "ACTION NEEDED — " : ""}New order ${order.order_number} — ${formatPrice(order.total_cents)}`,
    html: shell({
      preheader: `${order.customer_name} · ${order.shipping_city} · ${formatPrice(order.total_cents)}`,
      heading: `New order ${order.order_number}`,
      body,
    }),
  };
}

/** To the customer, when the admin marks the order shipped. */
export function orderShipped(order: EmailOrder, trackUrl: string, contact?: EmailContact) {
  const body = `
    ${P(`Good news, ${firstName(order.customer_name)} — order <strong style="color:${BRAND.ink};">${escapeHtml(order.order_number)}</strong> is on its way.`)}
    ${order.tracking_number
      ? P(`Tracking number: <strong style="color:${BRAND.ink};">${escapeHtml(order.tracking_number)}</strong>`)
      : P("Your courier will contact you on the number you gave us when they are close.")}
    ${addressBlock(order)}
    ${button(trackUrl, "View your order")}
    ${P("Colombo and suburbs usually arrive in 1&ndash;3 working days, other areas in 2&ndash;5.")}
  `;

  return {
    subject: `Order ${order.order_number} is on its way — Franley`,
    html: shell({
      preheader: "Your Franley order has been dispatched.",
      heading: "Your order has shipped",
      body,
      contact,
    }),
  };
}

/** To the customer, when the admin marks the order delivered. */
export function orderDelivered(order: EmailOrder, contact?: EmailContact) {
  const body = `
    ${P(`Order <strong style="color:${BRAND.ink};">${escapeHtml(order.order_number)}</strong> has been marked delivered. We hope it is exactly what you wanted.`)}
    ${P("If anything is not right, you have 7 days from delivery to arrange a return or exchange. Just reply to this email or message us on WhatsApp.")}
    ${button(`${siteUrl()}/care`, "How to care for your tie")}
    ${P("Untie it the way you tied it, rest it a day between wears, and roll it in a drawer. It will still look right in five years.")}
  `;

  return {
    subject: `Order ${order.order_number} delivered — Franley`,
    html: shell({
      preheader: "Thank you for shopping with Franley.",
      heading: "Delivered",
      body,
      contact,
    }),
  };
}

/** To the customer, when the admin cancels the order. */
export function orderCancelled(order: EmailOrder, reason?: string | null, contact?: EmailContact) {
  const body = `
    ${P(`Order <strong style="color:${BRAND.ink};">${escapeHtml(order.order_number)}</strong> has been cancelled.`)}
    ${reason ? P(`Reason: ${escapeHtml(reason)}`) : ""}
    ${order.payment_method !== "cod"
      ? P("If you had already paid, your refund is being processed back to the original payment method.")
      : P("Nothing was charged.")}
    ${button(`${siteUrl()}/shop`, "Browse the collection")}
    ${P("If this was not expected, reply to this email and we will sort it out.")}
  `;

  return {
    subject: `Order ${order.order_number} cancelled — Franley`,
    html: shell({
      preheader: "Your Franley order has been cancelled.",
      heading: "Order cancelled",
      body,
      contact,
    }),
  };
}

export type ContactEnquiry = {
  name: string;
  email: string;
  phone?: string | null;
  orderNumber?: string | null;
  message: string;
};

/** To the shop, from the storefront contact form. */
export function contactEnquiry(enquiry: ContactEnquiry) {
  const body = `
    ${P(`<strong style="color:${BRAND.ink};">${escapeHtml(enquiry.name)}</strong><br>
        <a href="mailto:${escapeHtml(enquiry.email)}" style="color:${BRAND.wine};">${escapeHtml(enquiry.email)}</a>
        ${enquiry.phone ? `<br><a href="tel:${escapeHtml(enquiry.phone.replace(/[^0-9+]/g, ""))}" style="color:${BRAND.wine};">${escapeHtml(enquiry.phone)}</a>` : ""}
        ${enquiry.orderNumber ? `<br>Order: <strong style="color:${BRAND.ink};">${escapeHtml(enquiry.orderNumber)}</strong>` : ""}`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;background:${BRAND.creamPanel};border-radius:12px;">
      <tr><td style="padding:18px 20px;">
        ${LABEL("Message")}
        <div style="margin-top:8px;font-family:${SANS};font-size:14px;line-height:1.75;color:${BRAND.ink};white-space:pre-wrap;">${escapeHtml(enquiry.message)}</div>
      </td></tr>
    </table>
    ${P(`Reply straight to this email — it goes back to the customer.`)}
  `;

  return {
    subject: `Website enquiry from ${enquiry.name}`,
    html: shell({
      preheader: enquiry.message.slice(0, 120),
      heading: "New website enquiry",
      body,
    }),
  };
}
