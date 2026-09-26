import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkoutSchema } from "@/lib/checkout/schema";
import { isLive } from "@/lib/data";
import { loadOrderForEmail, sendOrderPlacedEmails } from "@/lib/email/send";
import { buildCheckout, payhereEnabled } from "@/lib/payhere";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// What the checkout form sends: a UUID, or a timestamp-random pair on old browsers.
const IDEMPOTENCY_KEY = /^[A-Za-z0-9-]{8,64}$/;

/**
 * Places an order.
 *
 * The client sends product ids and quantities only. Every price, the subtotal,
 * the shipping and the total are recomputed inside `place_order` (see
 * 0006_rpc_checkout.sql), which also takes a row lock per product so two
 * simultaneous checkouts cannot oversell the last tie.
 */
export async function POST(request: NextRequest) {
  if (!isLive()) {
    return NextResponse.json(
      { error: "The store is not connected to its database yet. Add your Supabase keys to .env.local." },
      { status: 503 },
    );
  }

  // JSON only. Another website can make its visitors' browsers send a form or
  // text/plain POST here without asking; an application/json request needs a
  // CORS preflight this route never answers, so it cannot come cross-site.
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "Malformed request." }, { status: 415 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return NextResponse.json(
      { error: "Please check the highlighted fields.", fieldErrors },
      { status: 422 },
    );
  }

  const input = parsed.data;
  const payingByCard = input.paymentMethod === "card";

  // Every product id in the database is a uuid. Anything else is a bag saved
  // while the site ran on the bundled catalogue (ids like "seed-8"); sending it
  // on would fail inside place_order with an error the shopper can do nothing
  // about. Name the stale lines so the form can drop them from the bag.
  const staleItems = input.items.map((i) => i.productId).filter((id) => !UUID.test(id));
  if (staleItems.length) {
    return NextResponse.json(
      {
        error: "Some pieces in your bag were saved from an older version of the shop, so we have removed them. Please check your bag and add them again.",
        staleItems,
      },
      { status: 409 },
    );
  }

  // Refuse BEFORE the order exists: place_order takes stock, and a card order
  // nobody can pay for would hold it for nothing.
  if (payingByCard && !payhereEnabled()) {
    return NextResponse.json(
      { error: "Card payment is not available right now. Please choose another payment method." },
      { status: 422 },
    );
  }

  // place_order is executable by the server alone (0016_security_hardening.sql):
  // called straight from the browser with the publishable key, a script could
  // pick its own address hint per call, slip past the throttle, and hold the
  // whole catalogue as unpaid cash-on-delivery orders.
  let supabase: ReturnType<typeof createServiceClient>;
  try {
    supabase = createServiceClient();
  } catch {
    console.error("checkout: SUPABASE_SERVICE_ROLE_KEY is not set, so no order can be placed");
    return NextResponse.json(
      { error: "Checkout is unavailable for a moment. Please try again shortly, or WhatsApp us to order." },
      { status: 503 },
    );
  }

  // Lets a retried submission return the original order instead of a duplicate.
  // Anything not shaped like a key the form makes is ignored rather than sent
  // on to fail a length CHECK with a message about table internals.
  const rawKey = request.headers.get("x-idempotency-key");
  const idempotencyKey = rawKey && IDEMPOTENCY_KEY.test(rawKey) ? rawKey : null;

  const { data, error } = await supabase.rpc("place_order", {
    p_items: input.items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
    p_customer: { email: input.email, name: input.fullName, phone: input.phone },
    p_shipping: {
      line1: input.addressLine1,
      line2: input.addressLine2 || null,
      city: input.city,
      district: input.district,
      postal_code: input.postalCode || null,
      country: "LK",
    },
    p_payment_method: input.paymentMethod,
    p_note: input.notes || null,
    p_idempotency_key: idempotencyKey,
    p_ip_hint: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  if (error) {
    // 53400 = the checkout throttle.
    if (error.code === "53400") {
      return NextResponse.json({ error: "Too many checkout attempts. Please try again in a little while." }, { status: 429 });
    }
    // 23514 = a stock/quantity check the RPC raises deliberately; 22023 = bad
    // input it validated itself. Both carry a message written for a shopper —
    // but a table CHECK constraint fails with 23514 too, naming the table and
    // constraint, and that text must never reach the page.
    const shopperSafe =
      (error.code === "23514" || error.code === "22023" || error.code === "P0001") &&
      !/constraint|relation|column|violates/i.test(error.message);
    if (!shopperSafe) console.error("place_order failed", error);

    return NextResponse.json(
      { error: shopperSafe ? error.message : "We could not place your order. Please try again." },
      { status: shopperSafe ? 409 : 500 },
    );
  }

  const result = data as
    | {
        order_id?: string;
        order_number?: string;
        access_token?: string | null;
        currency?: string;
        total_cents?: number;
        duplicate?: boolean;
        // Only on the duplicate branch, and only once 0014_customers.sql has run.
        payment_method?: string;
        payment_status?: string;
      }
    | null;

  if (!result?.order_number) {
    console.error("place_order returned no order number", data);
    return NextResponse.json({ error: "We could not place your order. Please try again." }, { status: 500 });
  }

  // A retry of a submission that already placed an order — typically the
  // first response was lost to a flaky connection. The order exists and its
  // emails are already on their way (or, for a card order, waiting on
  // payment). The plaintext access token was handed out once and only its hash
  // is stored, so it cannot be given again: no order-page link and no PayHere
  // form, whose return URL would need it. The shopper is told what happened.
  if (result.duplicate) {
    // The STORED order's method decides, not this retry's: a shopper whose card
    // submission timed out may have switched to cash on delivery before trying
    // again, and the order that exists is still the unpaid card one.
    const storedMethod = result.payment_method ?? input.paymentMethod;
    return NextResponse.json({
      orderNumber: result.order_number,
      duplicate: true,
      awaitingPayment: storedMethod === "card" && result.payment_status !== "paid",
    });
  }

  // Confirmation emails. Deliberately awaited but fully guarded: the order is
  // already committed, so nothing here may turn a successful checkout into an
  // error the shopper sees. Awaiting (rather than firing and forgetting) is
  // what makes it work on serverless, where the function can be frozen the
  // moment the response is returned.
  //
  // A card order is not confirmed until PayHere says it is paid, so its emails
  // are sent from the payment notification instead — src/lib/payhere/record.ts.
  if (result.order_id && !payingByCard) {
    try {
      const summary = await loadOrderForEmail(result.order_id);
      if (summary) {
        await sendOrderPlacedEmails(summary, result.order_id, result.access_token ?? null);
      }
    } catch (err) {
      console.error("order emails failed", err);
    }
  }

  // The amount PayHere is asked for is the total place_order just computed and
  // froze — never anything the browser sent.
  const payhere =
    payingByCard && typeof result.total_cents === "number" && result.access_token
      ? buildCheckout({
          orderNumber: result.order_number,
          totalCents: result.total_cents,
          currency: result.currency ?? "LKR",
          customerName: input.fullName,
          customerEmail: input.email,
          customerPhone: input.phone,
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2 || null,
          city: input.city,
          accessToken: result.access_token ?? null,
        })
      : null;

  return NextResponse.json({
    orderNumber: result.order_number,
    accessToken: result.access_token ?? "",
    ...(payhere ? { payhere } : {}),
  });
}
