import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { loadOrderForEmail, sendOrderPlacedEmails } from "@/lib/email/send";
import { findReceivedPayment, paymentState, payhereLookupEnabled, type GatewayStatus } from "./index";

type RecordResult = {
  order_id: string;
  order_number: string;
  payment_status: string;
  changed: boolean;
  ignored?: boolean;
};

/**
 * Writes a VERIFIED gateway outcome onto the order. Callers must have checked
 * PayHere's signature (notify) or asked PayHere directly (lookup) first — this
 * runs with the service-role key and trusts what it is given.
 *
 * A card order's confirmation emails go out here rather than at checkout:
 * "your order is confirmed, payment received" is only true once it is.
 * sendOnce() makes them exactly-once however many times PayHere notifies.
 */
export async function recordGatewayPayment(payment: {
  orderNumber: string;
  status: GatewayStatus;
  amountCents: number;
  currency: string;
  reference: string | null;
  method: string | null;
  message: string | null;
  /** Only used for the email's tracking link, and only if it really opens this order. */
  accessToken: string | null;
}): Promise<{ ok: true; result: RecordResult } | { ok: false; code: string | null; message: string }> {
  let supabase: ReturnType<typeof createServiceClient>;
  try {
    supabase = createServiceClient();
  } catch (err) {
    // No service-role key. Answer as a failure so PayHere's call gets a 500 and
    // the log says why, rather than an unhandled exception.
    return { ok: false, code: null, message: err instanceof Error ? err.message : String(err) };
  }

  const { data, error } = await supabase.rpc("record_gateway_payment", {
    p_order_number: payment.orderNumber,
    p_gateway: "payhere",
    p_status: payment.status,
    p_amount_cents: payment.amountCents,
    p_currency: payment.currency,
    p_reference: payment.reference,
    p_method_detail: payment.method,
    p_message: payment.message,
  });
  if (error) return { ok: false, code: error.code ?? null, message: error.message };

  const result = data as RecordResult;

  if (result.payment_status === "paid") {
    try {
      const { data: row } = await supabase
        .from("orders")
        .select("status, payment_reference")
        .eq("id", result.order_id)
        .maybeSingle();

      // A second, DIFFERENT successful payment for an order that is already
      // paid — the shopper was charged twice. The database treats it as a
      // no-op, so say so in the order history, where the shop will see it.
      if (
        !result.changed &&
        payment.status === "paid" &&
        payment.reference &&
        row?.payment_reference &&
        row.payment_reference !== payment.reference
      ) {
        await flagSecondPayment(supabase, result.order_id, result.order_number, row.status, payment.reference, row.payment_reference);
      }

      const order = await loadOrderForEmail(result.order_id);
      if (order) {
        const token = await tokenOpensOrder(payment.accessToken, result.order_number);
        await sendOrderPlacedEmails(order, result.order_id, token, { paidAfterCancel: row?.status === "cancelled" });
      }
    } catch (err) {
      console.error("payment emails failed", err);
    }
  }

  return { ok: true, result };
}

/**
 * Writes the double-charge warning once, however many times PayHere retries.
 *
 * payment_id is not covered by PayHere's signature, so a genuine notification
 * replayed with an invented id would look like a second payment. PayHere is
 * asked first (when the App ID/Secret are set), and the note says how sure it
 * is — the shop must never refund a real payment because of a fake one.
 */
async function flagSecondPayment(
  supabase: ReturnType<typeof createServiceClient>,
  orderId: string,
  orderNumber: string,
  status: string,
  secondPaymentId: string,
  firstPaymentId: string,
) {
  const state = await paymentState(orderNumber, secondPaymentId);
  console.error("second PayHere payment reported for an order already paid", {
    orderId,
    firstPaymentId,
    secondPaymentId,
    payhereSays: state,
  });
  const lead = `SECOND PAYMENT ${secondPaymentId}`;
  const note =
    state === "RECEIVED"
      ? `${lead} received for an order already paid by ${firstPaymentId} — refund one of them in PayHere.`
      : state === "unknown"
        ? `${lead} reported for an order already paid by ${firstPaymentId}, but PayHere could not be asked to confirm it. Check the PayHere dashboard before refunding anything.`
        : `${lead} reported for an order already paid by ${firstPaymentId}, but PayHere does not list it as received (${state}). Probably not a real payment — refund nothing unless it appears in the PayHere dashboard.`;
  const { count } = await supabase
    .from("order_events")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId)
    .ilike("note", `${lead} %`);
  if (count) return;
  await supabase.from("order_events").insert({
    order_id: orderId,
    from_status: status,
    to_status: status,
    actor_kind: "system",
    note: note.slice(0, 500),
  });
}

/** custom_1 is not covered by md5sig, so it is checked against the order before it goes in an email. */
async function tokenOpensOrder(token: string | null, orderNumber: string) {
  if (!token) return null;
  const { data, error } = await createServiceClient().rpc("get_order_by_token", { p_token: token });
  if (error || (data as { order_number?: string } | null)?.order_number !== orderNumber) return null;
  return token;
}

/**
 * Asks PayHere whether an unpaid card order has in fact been paid, and records
 * it if so. Called from the order page when the shopper comes back before (or
 * without) the notify call. Returns true when the order is now paid.
 */
export async function reconcilePayment(order: {
  orderNumber: string;
  totalCents: number;
  currency: string;
  accessToken: string | null;
}): Promise<boolean> {
  if (!payhereLookupEnabled()) return false;
  try {
    const found = await findReceivedPayment(order.orderNumber, order.totalCents, order.currency);
    if (!found) return false;

    const recorded = await recordGatewayPayment({
      orderNumber: order.orderNumber,
      status: "paid",
      amountCents: found.amountCents,
      currency: found.currency,
      reference: found.paymentId,
      method: found.method,
      message: "confirmed by payment lookup",
      accessToken: order.accessToken,
    });
    if (!recorded.ok) console.error("payment reconcile failed", recorded.message);
    return recorded.ok && recorded.result.payment_status === "paid";
  } catch (err) {
    console.error("payment reconcile failed", err);
    return false;
  }
}
