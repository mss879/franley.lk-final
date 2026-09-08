import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkoutSchema } from "@/lib/checkout/schema";
import { isLive } from "@/lib/data";
import { sendOrderPlacedEmails } from "@/lib/email/send";
import type { EmailOrder } from "@/lib/email/templates";

export const runtime = "nodejs";

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
  const supabase = await createClient();

  // Lets a retried submission return the original order instead of a duplicate.
  const idempotencyKey = request.headers.get("x-idempotency-key");

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
    // 23514 = a stock/quantity check the RPC raises deliberately; 22023 = bad
    // input it validated itself. Both carry a message safe to show a shopper.
    const shopperSafe = error.code === "23514" || error.code === "22023" || error.code === "P0001";
    if (!shopperSafe) console.error("place_order failed", error);

    return NextResponse.json(
      { error: shopperSafe ? error.message : "We could not place your order. Please try again." },
      { status: shopperSafe ? 409 : 500 },
    );
  }

  const result = data as
    | { order_id?: string; order_number?: string; access_token?: string | null }
    | null;

  if (!result?.order_number) {
    console.error("place_order returned no order number", data);
    return NextResponse.json({ error: "We could not place your order. Please try again." }, { status: 500 });
  }

  // Confirmation emails. Deliberately awaited but fully guarded: the order is
  // already committed, so nothing here may turn a successful checkout into an
  // error the shopper sees. Awaiting (rather than firing and forgetting) is
  // what makes it work on serverless, where the function can be frozen the
  // moment the response is returned.
  if (result.order_id) {
    try {
      const summary = await loadOrderForEmail(supabase, result.order_id);
      if (summary) {
        await sendOrderPlacedEmails(summary, result.order_id, result.access_token ?? null);
      }
    } catch (err) {
      console.error("order emails failed", err);
    }
  }

  return NextResponse.json({
    orderNumber: result.order_number,
    accessToken: result.access_token ?? "",
  });
}

/**
 * Reads back the order the RPC just created, for the confirmation email.
 * Uses the service client because `anon` deliberately has no SELECT on orders —
 * see 0005_orders.sql. Nothing from this read is returned to the browser.
 */
async function loadOrderForEmail(
  _caller: Awaited<ReturnType<typeof createClient>>,
  orderId: string,
): Promise<EmailOrder | null> {
  const { createServiceClient } = await import("@/lib/supabase/server");
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

  if (error || !data) {
    console.error("could not load order for email", error);
    return null;
  }
  return data as unknown as EmailOrder;
}
