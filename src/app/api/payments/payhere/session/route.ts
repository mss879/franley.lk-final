import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isLive } from "@/lib/data";
import { buildCheckout, payhereEnabled } from "@/lib/payhere";

export const runtime = "nodejs";

const schema = z.object({
  orderNumber: z.string().regex(/^FR-\d{6,}$/i),
  token: z.string().regex(/^[0-9a-f]{64}$/),
});

/**
 * A fresh signed PayHere form for an order that already exists — the "Pay now"
 * button on the order page, for a shopper whose first attempt was cancelled or
 * declined. The order's access token is the credential, exactly as it is for
 * viewing the order; the amount comes from the order, never from the request.
 */
export async function POST(request: NextRequest) {
  if (!isLive() || !payhereEnabled()) {
    return NextResponse.json({ error: "Card payment is not available right now." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid order link." }, { status: 422 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_order_by_token", { p_token: parsed.data.token });
  const order = data as {
    order_number: string;
    status: string;
    payment_status: string;
    payment_method: string;
    currency: string;
    total_cents: number;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    shipping_line1: string;
    shipping_line2: string | null;
    shipping_city: string;
  } | null;

  if (error || !order || order.order_number.toUpperCase() !== parsed.data.orderNumber.toUpperCase()) {
    return NextResponse.json({ error: "We could not open that order." }, { status: 404 });
  }

  // "pending" means PayHere is still processing an earlier attempt. A second
  // form now could charge the shopper twice — PayHere does not enforce unique
  // order ids — so they wait for that one to settle.
  if (order.payment_method === "card" && order.payment_status === "pending") {
    return NextResponse.json(
      { error: "Your earlier payment is still being processed by PayHere. Please wait a few minutes before trying again." },
      { status: 409 },
    );
  }

  const payable =
    order.payment_method === "card" &&
    !["paid", "refunded"].includes(order.payment_status) &&
    !["cancelled", "refunded"].includes(order.status);
  if (!payable) {
    return NextResponse.json({ error: "This order does not need a payment." }, { status: 409 });
  }

  const payhere = buildCheckout({
    orderNumber: order.order_number,
    totalCents: order.total_cents,
    currency: order.currency,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    customerPhone: order.customer_phone,
    addressLine1: order.shipping_line1,
    addressLine2: order.shipping_line2,
    city: order.shipping_city,
    accessToken: parsed.data.token,
  });
  if (!payhere) return NextResponse.json({ error: "Card payment is not available right now." }, { status: 503 });

  return NextResponse.json({ payhere });
}
