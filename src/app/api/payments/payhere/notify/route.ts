import { type NextRequest } from "next/server";
import { verifyNotification } from "@/lib/payhere";
import { recordGatewayPayment } from "@/lib/payhere/record";

export const runtime = "nodejs";

/**
 * PayHere's server-to-server payment notification (`notify_url`).
 *
 * This is the ONLY thing that marks a card order paid. The shopper's browser
 * coming back to /order/<number> proves nothing — PayHere passes no status on
 * the return URL precisely so that nobody trusts it.
 *
 * The body is application/x-www-form-urlencoded, not JSON. Nothing is acted on
 * until `md5sig` has been checked against the merchant secret.
 */
export async function POST(request: NextRequest) {
  let params: Record<string, string>;
  try {
    const form = await request.formData();
    params = Object.fromEntries(
      Array.from(form.entries()).filter((e): e is [string, string] => typeof e[1] === "string"),
    );
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const verified = verifyNotification(params);
  if (!verified.ok) {
    // Never log the body wholesale: it carries the customer's name and card mask.
    console.warn("payhere notify refused", { reason: verified.reason, order: params.order_id ?? null });
    return new Response("Forbidden", { status: verified.reason === "payhere-not-configured" ? 503 : 403 });
  }

  const n = verified.notification;
  const recorded = await recordGatewayPayment({
    orderNumber: n.orderNumber,
    status: n.status,
    amountCents: n.amountCents,
    currency: n.currency,
    reference: n.paymentId,
    method: n.method,
    // -3 arrives as "refunded"; say why, so the order history reads as a chargeback.
    message: n.statusCode === "-3" ? `Chargeback${n.message ? `: ${n.message}` : ""}` : n.message,
    accessToken: n.custom1,
  });

  if (!recorded.ok) {
    console.error("payhere notify could not be recorded", {
      order: n.orderNumber,
      payment: n.paymentId,
      status: n.statusCode,
      code: recorded.code,
      message: recorded.message,
    });
    // P0002 unknown order, 22023 not a card order, 23514 amount mismatch: a
    // genuine, signed notification this store will never be able to apply, so
    // retrying it is pointless. Anything else is ours to fix — say so.
    const permanent = ["P0002", "22023", "23514"].includes(recorded.code ?? "");
    return new Response(permanent ? "Unprocessable" : "Error", { status: permanent ? 422 : 500 });
  }

  return new Response("OK", { status: 200 });
}
