import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Image from "next/image";
import { CheckCircle2, Package, Truck, Home } from "lucide-react";
import { PageHeader } from "@/components/site/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { WhatsAppIcon } from "@/components/ui/social-icons";
import { createClient } from "@/lib/supabase/server";
import { isLive } from "@/lib/data";
import { formatPrice } from "@/lib/utils";
import { buildMetadata } from "@/lib/seo";
import { OrderPayment } from "@/components/shop/order-payment";
import { payhereEnabled } from "@/lib/payhere";
import { reconcilePayment } from "@/lib/payhere/record";
import { getSiteSettings } from "@/lib/settings";
import { waLink } from "@/lib/settings/shipping";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ number: string }>;
}): Promise<Metadata> {
  const { number } = await params;
  return buildMetadata({
    title: "Your Order",
    description: "Your Franley order confirmation and delivery status.",
    // Reachable only with the emailed token, so the canonical drops the query.
    canonical: `/order/${number}`,
    noindex: true,
  });
}

export const dynamic = "force-dynamic";

type OrderItem = {
  product_title: string;
  variant_label: string | null;
  image_url: string | null;
  unit_price_cents: number;
  quantity: number;
};

type Order = {
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string;
  currency: string;
  subtotal_cents: number;
  shipping_cents: number;
  discount_cents: number;
  total_cents: number;
  customer_name: string;
  customer_email: string;
  shipping_line1: string;
  shipping_line2: string | null;
  shipping_city: string;
  shipping_district: string | null;
  tracking_number: string | null;
  /** From 0015_ops_and_fixes.sql on; absent on an older database. */
  payment_method_detail?: string | null;
  items: OrderItem[];
};

const STAGES = [
  { key: "confirmed", label: "Confirmed", Icon: CheckCircle2 },
  { key: "packed", label: "Packed", Icon: Package },
  { key: "shipped", label: "On the way", Icon: Truck },
  { key: "delivered", label: "Delivered", Icon: Home },
];
const ORDER_OF = ["pending", "confirmed", "packed", "shipped", "delivered"];
/** Statuses that end the order. They are not points on the progress track. */
const TERMINAL: Record<string, string> = { cancelled: "cancelled", refunded: "refunded" };
/** `next_order_number()` mints FR- plus a zero-padded sequence. */
const ORDER_NUMBER_RE = /^FR-\d{6,}$/i;

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: Promise<{ token?: string; payment?: string }>;
}) {
  const [{ number }, { token, payment }, settings] = await Promise.all([params, searchParams, getSiteSettings()]);

  // /order/<anything> used to render a full "Order <anything> is placed"
  // confirmation for any path segment at all. Only a well-formed order number
  // can name a real order.
  if (!ORDER_NUMBER_RE.test(number)) notFound();

  // `order === null` now means exactly one thing: we could not open the order.
  // Without a token, without a database, on an RPC error, or on a token that
  // matched nothing, the page says so instead of confirming an order.
  let order: Order | null = null;

  if (isLive() && token) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_order_by_token", { p_token: token });
    if (error) console.error("order lookup failed", error.message);
    else if (data) order = data as Order;

    // Back from PayHere, and the notification has not landed (it cannot, on
    // localhost). `payment=return` is only a hint to go and ASK PayHere — it is
    // never taken as proof of anything.
    if (
      order &&
      payment === "return" &&
      order.payment_method === "card" &&
      !["paid", "refunded"].includes(order.payment_status) &&
      (await reconcilePayment({
        orderNumber: order.order_number,
        totalCents: order.total_cents,
        currency: order.currency,
        accessToken: token,
      }))
    ) {
      const fresh = await supabase.rpc("get_order_by_token", { p_token: token });
      if (fresh.data) order = fresh.data as Order;
    }
  }

  // indexOf() returns -1 for cancelled/refunded, which made every stage read as
  // not-done and left the page claiming the order was on its way.
  const terminal = order ? TERMINAL[order.status] ?? null : null;
  const reached = order && !terminal ? ORDER_OF.indexOf(order.status) : -1;
  // A card order that has not been paid is held, not confirmed.
  const awaitingPayment =
    !!order && !terminal && order.payment_method === "card" && !["paid", "refunded"].includes(order.payment_status);

  return (
    <>
      <PageHeader
        eyebrow={terminal ? "Order update" : order ? "Thank you" : "Order lookup"}
        title={
          order
            ? terminal
              ? `Order ${order.order_number} was ${terminal}`
              : awaitingPayment
                ? `Order ${order.order_number} is awaiting payment`
                : `Order ${order.order_number} is placed`
            : "We could not open that order"
        }
        lede={
          order
            ? terminal === "refunded"
              ? "This order was refunded. The amount goes back the way it was paid — message us if you need the details."
              : terminal === "cancelled"
                ? "This order was cancelled, so nothing is on its way. Message us if that is a surprise."
                : awaitingPayment
                  ? "Your pieces are held for you. The order is confirmed as soon as your payment comes through."
                  : "We have your order. You will hear from us on WhatsApp as soon as it is on its way."
            : "This link did not open an order. It may have expired, or been mistyped."
        }
      />

      <div className="mx-auto max-w-[1400px] px-5 py-14 md:px-10 md:py-20">
        {order ? (
          <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
            <div>
              {/* Progress */}
              {terminal ? (
                <div role="status" className="rounded-2xl border border-champagne-300 bg-champagne-100/60 p-6">
                  <p className="font-display text-xl text-ink-900">
                    This order was {terminal}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">
                    It is no longer being prepared or delivered. If you were
                    expecting it, message us and we will explain what happened.
                  </p>
                </div>
              ) : (
              <ol className="grid grid-cols-4 gap-2">
                {STAGES.map(({ key, label, Icon }) => {
                  const done = ORDER_OF.indexOf(key) <= reached;
                  return (
                    <li key={key} className="flex flex-col items-center text-center">
                      <span
                        className={
                          done
                            ? "grid h-11 w-11 place-items-center rounded-full bg-ink-900 text-cream-50"
                            : "grid h-11 w-11 place-items-center rounded-full border border-cream-300 text-ink-400"
                        }
                      >
                        <Icon className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                      </span>
                      <span className={`mt-2 text-xs ${done ? "text-ink-900" : "text-ink-600"}`}>{label}</span>
                    </li>
                  );
                })}
              </ol>
              )}

              <ul className="mt-12 divide-y divide-cream-300 border-y border-cream-300">
                {order.items.map((item, i) => (
                  <li key={i} className="flex gap-4 py-5">
                    <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-lg border border-cream-300 bg-white">
                      {item.image_url && (
                        <Image src={item.image_url} alt="" fill sizes="80px" className="object-contain p-1.5" />
                      )}
                    </div>
                    <div className="flex flex-1 items-center justify-between gap-4">
                      <div>
                        <p className="font-display text-base">{item.product_title}</p>
                        {item.variant_label && <p className="mt-0.5 text-xs text-ink-600">{item.variant_label}</p>}
                        <p className="mt-1 text-xs text-ink-600">Qty {item.quantity}</p>
                      </div>
                      <span className="shrink-0 text-sm tabular-nums">
                        {formatPrice(item.unit_price_cents * item.quantity)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                <Eyebrow>Delivering to</Eyebrow>
                <address className="mt-3 text-sm not-italic leading-relaxed text-ink-600">
                  {order.customer_name}<br />
                  {order.shipping_line1}<br />
                  {order.shipping_line2 && <>{order.shipping_line2}<br /></>}
                  {order.shipping_city}
                  {order.shipping_district && `, ${order.shipping_district}`}
                </address>
              </div>
            </div>

            <aside className="h-fit rounded-3xl border border-cream-300 bg-cream-100 p-7">
              <h2 className="font-display text-2xl">Summary</h2>
              <dl className="mt-6 space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-600">Subtotal</dt>
                  <dd className="tabular-nums">{formatPrice(order.subtotal_cents)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-600">Delivery</dt>
                  <dd className="tabular-nums">
                    {order.shipping_cents === 0 ? "Free" : formatPrice(order.shipping_cents)}
                  </dd>
                </div>
                {order.discount_cents > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-ink-600">Discount</dt>
                    <dd className="tabular-nums">−{formatPrice(order.discount_cents)}</dd>
                  </div>
                )}
                <div className="flex justify-between border-t border-cream-300 pt-4">
                  <dt className="font-display text-lg">Total</dt>
                  <dd className="font-display text-lg tabular-nums">{formatPrice(order.total_cents)}</dd>
                </div>
              </dl>

              {awaitingPayment && token && payhereEnabled() ? (
                <OrderPayment
                  orderNumber={order.order_number}
                  token={token}
                  returning={payment === "return"}
                  failed={order.payment_status === "failed"}
                  processing={order.payment_status === "pending"}
                />
              ) : (
                <p className="mt-5 rounded-2xl bg-cream-200 px-4 py-3 text-xs leading-relaxed text-ink-600">
                  {order.payment_method === "cod"
                    ? "Pay the courier in cash when your order arrives."
                    : order.payment_method === "card"
                      ? order.payment_status === "paid"
                        ? `Paid online through PayHere${order.payment_method_detail ? ` with ${order.payment_method_detail}` : ""}. Thank you — your payment has been received.`
                        : order.payment_status === "refunded"
                          ? "This payment was refunded to the original payment method."
                          : "This order has not been paid. Message us and we will help you complete it."
                      : settings.bankTransferDetails
                        ? "Transfer the total to the account below and send us the slip on WhatsApp. Your order ships once payment clears."
                        : "We will send bank transfer details to your email shortly. Your order ships once payment clears."}
                  {order.payment_method === "bank_transfer" &&
                    order.payment_status !== "paid" &&
                    settings.bankTransferDetails && (
                      <span className="mt-3 block whitespace-pre-line rounded-xl bg-cream-50 px-4 py-3 text-ink-800">
                        {settings.bankTransferDetails}
                      </span>
                    )}
                </p>
              )}

              {order.tracking_number && (
                <p className="mt-4 text-xs text-ink-600">
                  Tracking: <strong className="text-ink-900">{order.tracking_number}</strong>
                </p>
              )}

              <ButtonLink
                href={waLink(settings.whatsapp, `Hi Franley, about order ${order.order_number}`)}
                variant="outline"
                className="mt-6 w-full"
              >
                <WhatsAppIcon className="h-4 w-4" />
                Ask about this order
              </ButtonLink>

              <p className="mt-5 text-center text-xs text-ink-600">
                Keep this page bookmarked — the link is how you check on this order.
              </p>
            </aside>
          </div>
        ) : (
          <div className="mx-auto max-w-lg rounded-3xl border border-cream-300 bg-cream-100 p-9 text-center">
            <h2 className="font-display text-2xl">We could not open that order link</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-600">
              The link may have expired or been mistyped. Message us on WhatsApp
              with your order number and we will pull it up.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <ButtonLink href={waLink(settings.whatsapp)}>
                <WhatsAppIcon className="h-4 w-4" />
                Message us
              </ButtonLink>
              <ButtonLink href="/shop" variant="outline">Keep shopping</ButtonLink>
            </div>
          </div>
        )}

        <p className="mt-12 text-center text-xs text-ink-600">
          Questions? <Link href="/contact" className="underline underline-offset-4 hover:text-wine-700">Contact us</Link>
          {" · "}
          <Link href="/returns" className="underline underline-offset-4 hover:text-wine-700">Returns policy</Link>
        </p>
      </div>
    </>
  );
}
