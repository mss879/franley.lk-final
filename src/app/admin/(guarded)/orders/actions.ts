"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/admin-guard";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendOrderStatusEmail } from "@/lib/email/send";
import type { EmailOrder } from "@/lib/email/templates";
import { ORDER_STATUSES, ORDER_STATUS_LABEL, PAYMENT_STATUSES } from "@/components/admin/orders/status";
import { paymentState, payhereRefundEnabled, refundPayment } from "@/lib/payhere";
import { formatPrice } from "@/lib/utils";

export type ActionState = { ok: boolean; message: string } | null;

const idSchema = z.uuid("That order reference is not valid.");

const statusSchema = z.object({
  orderId: idSchema,
  status: z.enum(ORDER_STATUSES),
  note: z.string().max(500, "Keep the note under 500 characters.").optional(),
});

const cancelSchema = z.object({
  orderId: idSchema,
  restock: z.boolean(),
  reason: z.string().max(500, "Keep the reason under 500 characters.").optional(),
});

const paymentSchema = z.object({
  orderId: idSchema,
  paymentStatus: z.enum(PAYMENT_STATUSES),
  note: z.string().max(500, "Keep the note under 500 characters.").optional(),
});

const noteSchema = z.object({
  orderId: idSchema,
  adminNote: z.string().max(2000, "Keep the note under 2000 characters."),
});

const trackingSchema = z.object({
  orderId: idSchema,
  trackingNumber: z.string().max(80, "Keep the tracking number under 80 characters."),
});

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function firstIssue(error: z.ZodError): ActionState {
  return { ok: false, message: error.issues[0]?.message ?? "Check the form and try again." };
}


/**
 * Reads the order back for a status email. Uses the service client so the
 * shape matches what the templates expect regardless of column-level grants,
 * and returns null rather than throwing — a status change must succeed even
 * when the mail cannot be composed.
 */
async function loadOrderForEmail(orderId: string): Promise<EmailOrder | null> {
  try {
    const admin = createServiceClient();
    const { data, error } = await admin
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
    if (error || !data) return null;
    return data as unknown as EmailOrder;
  } catch {
    return null;
  }
}

/** Best-effort customer notification. Never allowed to fail the action. */
async function notifyCustomer(
  orderId: string,
  status: "shipped" | "delivered" | "cancelled",
  extra?: { reason?: string | null },
) {
  try {
    const order = await loadOrderForEmail(orderId);
    if (order) await sendOrderStatusEmail(order, orderId, status, extra);
  } catch (err) {
    console.error("status email failed", err);
  }
}

function revalidate(orderId: string) {
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
}

/**
 * Status only ever moves through the RPC: it is what validates the transition,
 * stamps confirmed_at/shipped_at/delivered_at and writes the audit row. A
 * direct UPDATE would do none of those, and `authenticated` is not granted one.
 */
export async function updateOrderStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = statusSchema.safeParse({
    orderId: field(formData, "orderId"),
    status: field(formData, "status"),
    note: field(formData, "note") || undefined,
  });
  if (!parsed.success) return firstIssue(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_order_status", {
    p_order_id: parsed.data.orderId,
    p_status: parsed.data.status,
    p_note: parsed.data.note ?? null,
  });

  // The RPC refuses illegal transitions with a message written for a person.
  if (error) return { ok: false, message: error.message };

  // Only these three are worth an email. "Packed" and "confirmed" are internal
  // steps a customer does not need a message about.
  const status = parsed.data.status;
  if (status === "shipped" || status === "delivered") {
    await notifyCustomer(parsed.data.orderId, status);
  }

  revalidate(parsed.data.orderId);
  return { ok: true, message: `Moved to ${ORDER_STATUS_LABEL[status].toLowerCase()}.` };
}

export async function cancelOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = cancelSchema.safeParse({
    orderId: field(formData, "orderId"),
    restock: field(formData, "restock") === "on",
    reason: field(formData, "reason") || undefined,
  });
  if (!parsed.success) return firstIssue(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_cancel_order", {
    p_order_id: parsed.data.orderId,
    p_restock: parsed.data.restock,
    p_reason: parsed.data.reason ?? null,
  });
  if (error) return { ok: false, message: error.message };

  await notifyCustomer(parsed.data.orderId, "cancelled", { reason: parsed.data.reason ?? null });

  revalidate(parsed.data.orderId);
  return {
    ok: true,
    message: parsed.data.restock
      ? "Order cancelled and the stock returned to the shelf."
      : "Order cancelled. Stock was left as it is.",
  };
}

/** admin_note and tracking_number are the only two columns `authenticated` may
 *  UPDATE — every money column is frozen by a trigger. */
export async function saveAdminNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = noteSchema.safeParse({
    orderId: field(formData, "orderId"),
    adminNote: field(formData, "adminNote"),
  });
  if (!parsed.success) return firstIssue(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ admin_note: parsed.data.adminNote || null })
    .eq("id", parsed.data.orderId);
  if (error) return { ok: false, message: error.message };

  revalidate(parsed.data.orderId);
  return { ok: true, message: parsed.data.adminNote ? "Note saved." : "Note cleared." };
}

export async function saveTrackingNumber(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = trackingSchema.safeParse({
    orderId: field(formData, "orderId"),
    trackingNumber: field(formData, "trackingNumber"),
  });
  if (!parsed.success) return firstIssue(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ tracking_number: parsed.data.trackingNumber || null })
    .eq("id", parsed.data.orderId);
  if (error) return { ok: false, message: error.message };

  revalidate(parsed.data.orderId);
  return {
    ok: true,
    message: parsed.data.trackingNumber ? "Tracking number saved." : "Tracking number cleared.",
  };
}

/**
 * Payment state moves through its own RPC, for the same reason status does:
 * `authenticated` holds UPDATE on (admin_note, tracking_number) only, so there
 * is no direct write path. Without this, a bank transfer whose slip has arrived
 * — and every card order — could never be marked paid.
 */
export async function updatePaymentStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = paymentSchema.safeParse({
    orderId: field(formData, "orderId"),
    paymentStatus: field(formData, "paymentStatus"),
    note: field(formData, "note") || undefined,
  });
  if (!parsed.success) return firstIssue(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_payment_status", {
    p_order_id: parsed.data.orderId,
    p_status: parsed.data.paymentStatus,
    p_note: parsed.data.note ?? null,
  });

  if (error) return { ok: false, message: error.message };

  revalidate(parsed.data.orderId);
  return { ok: true, message: "Payment status updated." };
}

const releaseSchema = z.object({
  hours: z.coerce.number().int("Whole hours only.").min(1, "At least 1 hour.").max(720, "At most 720 hours (30 days)."),
});

/**
 * Cancels, with restock, every card order still waiting for payment after N
 * hours. A card order takes its stock the moment it is placed, so a shopper
 * who closed the PayHere page would otherwise hold those pieces forever. No
 * email: they never paid and never received a confirmation.
 */
export async function releaseStaleCardOrders(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = releaseSchema.safeParse({ hours: field(formData, "hours") || "24" });
  if (!parsed.success) return firstIssue(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_cancel_stale_card_orders", { p_hours: parsed.data.hours });
  if (error) return { ok: false, message: error.message };

  const result = data as { released?: number; order_numbers?: string[] } | null;
  const released = result?.released ?? 0;
  revalidatePath("/admin/orders");

  if (!released) return { ok: true, message: `No pending, unpaid card orders older than ${parsed.data.hours} hours.` };
  return {
    ok: true,
    message: `Released ${released} order${released === 1 ? "" : "s"} and returned the stock: ${(result?.order_numbers ?? []).join(", ")}.`,
  };
}

const refundSchema = z.object({
  orderId: idSchema,
  reason: z.string().min(3, "Say briefly why — PayHere shows it on the refund.").max(200, "Keep the reason under 200 characters."),
  cancelAndRestock: z.boolean(),
});

/**
 * Puts a refund on the order's record. admin_set_payment_status does the
 * paid -> refunded move and writes the note — but only when the status
 * actually changes. If a chargeback or another admin got there first, or the
 * write fails, the PayHere reference must still land in the order history, so
 * it is written directly (service role) and, failing that, logged.
 */
async function recordRefund(
  order: { id: string; status: string },
  note: string,
  adminUserId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_set_payment_status", {
    p_order_id: order.id,
    p_status: "refunded",
    p_note: note,
  });
  if (!error && (data as { changed?: boolean } | null)?.changed !== false) return { ok: true };

  try {
    const { error: eventError } = await createServiceClient().from("order_events").insert({
      order_id: order.id,
      from_status: order.status,
      to_status: order.status,
      actor_kind: "admin",
      actor_user_id: adminUserId,
      note: note.slice(0, 500),
    });
    if (eventError) throw eventError;
  } catch (err) {
    console.error("PayHere refund could not be written to the order history", { orderId: order.id, note, err });
  }
  return error ? { ok: false, message: error.message } : { ok: true };
}

/**
 * Refunds a PayHere card payment in full through PayHere's Refund API, then
 * records it with admin_set_payment_status — the admin is the actor, so the
 * audit row says so, and the RPC enforces paid -> refunded.
 * record_gateway_payment stays reserved for PayHere's own verified callbacks.
 *
 * PayHere is asked about the payment BEFORE anything is sent. That is what
 * makes pressing the button again safe after a timeout: a refund that did go
 * through shows up as REFUND REQUESTED / REFUNDED and is recorded here, never
 * sent a second time.
 */
export async function refundViaPayHere(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = refundSchema.safeParse({
    orderId: field(formData, "orderId"),
    reason: field(formData, "reason"),
    cancelAndRestock: field(formData, "cancelAndRestock") === "on",
  });
  if (!parsed.success) return firstIssue(parsed.error);
  if (!payhereRefundEnabled()) {
    return { ok: false, message: "Refunds from here need PAYHERE_APP_ID and PAYHERE_APP_SECRET. Refund in the PayHere dashboard, then mark the payment refunded." };
  }

  const { orderId, reason, cancelAndRestock } = parsed.data;
  const supabase = await createClient();
  const { data: order, error: readError } = await supabase
    .from("orders")
    .select("id, order_number, status, payment_method, payment_status, payment_gateway, payment_reference, total_cents")
    .eq("id", orderId)
    .maybeSingle();
  if (readError) return { ok: false, message: readError.message };
  if (!order) return { ok: false, message: "That order no longer exists." };

  if (order.payment_method !== "card" || order.payment_gateway !== "payhere" || !order.payment_reference) {
    return { ok: false, message: "Only card orders paid through PayHere can be refunded from here." };
  }
  if (order.payment_status !== "paid") {
    return { ok: false, message: "This payment is not in the paid state, so there is nothing to refund." };
  }

  // 1. What does PayHere say about this payment right now?
  const state = await paymentState(order.order_number, order.payment_reference);
  if (state === "unknown") {
    return { ok: false, message: "Could not check this payment with PayHere, so nothing was sent. Try again in a moment, or refund in the PayHere dashboard." };
  }
  if (state === "missing") {
    return { ok: false, message: `PayHere has no successful payment ${order.payment_reference} for ${order.order_number}. Check the PayHere dashboard — nothing was sent.` };
  }
  if (state !== "RECEIVED") {
    // Already on its way back (or charged back). Record it; never refund twice.
    const recorded = await recordRefund(order, `PayHere shows payment ${order.payment_reference} as ${state.toLowerCase()}: ${reason}`, admin.userId);
    revalidate(orderId);
    return recorded.ok
      ? { ok: true, message: `PayHere already shows this payment as ${state.toLowerCase()}, so nothing was sent again. The order is now marked refunded.` }
      : { ok: false, message: `PayHere already shows this payment as ${state.toLowerCase()}, but the order could not be updated: ${recorded.message}` };
  }

  // 2. Refund it.
  const refund = await refundPayment(order.payment_reference, `Order ${order.order_number}: ${reason}`);
  if (!refund.ok) {
    const fallback =
      refund.code === "access-denied" || refund.code === "auth"
        ? " Refund it in the PayHere dashboard instead, then mark the payment refunded here."
        : refund.code === "unknown"
          ? " Pressing the button again is safe: it asks PayHere first and will not send a second refund."
          : "";
    return { ok: false, message: `${refund.message}${fallback}` };
  }

  // 3. The money has gone back. From here on, never lose the refund number.
  const ref = refund.refundNumber ? `PayHere refund ${refund.refundNumber}` : "PayHere refund";
  const recorded = await recordRefund(order, `${ref}: ${reason}`, admin.userId);
  if (!recorded.ok) {
    revalidate(orderId);
    return {
      ok: false,
      message: `PayHere refunded ${formatPrice(order.total_cents)} (${ref}), but the order could not be updated: ${recorded.message}. The reference is in the order history — mark the payment refunded by hand.`,
    };
  }

  let cancelled = false;
  if (cancelAndRestock && ["pending", "confirmed", "packed", "shipped"].includes(order.status)) {
    const { error: cancelError } = await supabase.rpc("admin_cancel_order", {
      p_order_id: orderId,
      p_restock: true,
      p_reason: `Refunded via PayHere (${ref})`,
    });
    if (!cancelError) {
      cancelled = true;
      await notifyCustomer(orderId, "cancelled", { reason });
    }
  }

  revalidate(orderId);
  return {
    ok: true,
    message: `Refunded ${formatPrice(order.total_cents)} through PayHere (${ref}).${cancelled ? " The order is cancelled and its stock returned." : ""}`,
  };
}
