"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/admin-guard";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendOrderStatusEmail } from "@/lib/email/send";
import type { EmailOrder } from "@/lib/email/templates";
import { ORDER_STATUSES, ORDER_STATUS_LABEL, PAYMENT_STATUSES } from "@/components/admin/orders/status";

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
