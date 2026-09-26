import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ImageOff, Mail, Phone } from "lucide-react";
import { AdminPageShell } from "@/components/admin/page-shell";
import { ButtonLink } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/ui/social-icons";
import { createClient } from "@/lib/supabase/server";
import { cn, formatPrice } from "@/lib/utils";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/admin/orders/status-badge";
import { OrderStatusControls } from "@/components/admin/orders/order-status-controls";
import { PaymentStatusControls } from "@/components/admin/orders/payment-status-controls";
import { EmailLog, type EmailLogRow } from "@/components/admin/orders/email-log";
import { emailEnabled } from "@/lib/email/send";
import { OrderCancelForm } from "@/components/admin/orders/order-cancel-form";
import { AdminNoteForm, TrackingForm } from "@/components/admin/orders/order-annotations";
import { OrderTimeline, type OrderEvent } from "@/components/admin/orders/order-timeline";
import { formatDateTime, whatsappHref } from "@/components/admin/orders/format";
import { RefundForm } from "@/components/admin/orders/refund-form";
import { payhereRefundEnabled } from "@/lib/payhere";
import {
  CANCELLABLE_STATUSES,
  NEXT_STATUSES,
  PAYMENT_METHOD_LABEL,
  type OrderStatus,
  type PaymentMethod,
  type PaymentStatus,
} from "@/components/admin/orders/status";

export const metadata: Metadata = { title: "Order" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Order = {
  id: string;
  order_number: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  currency: string;
  subtotal_cents: number;
  shipping_cents: number;
  discount_cents: number;
  total_cents: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_line1: string;
  shipping_line2: string | null;
  shipping_city: string;
  shipping_district: string | null;
  shipping_postal_code: string | null;
  shipping_country: string;
  customer_note: string | null;
  admin_note: string | null;
  tracking_number: string | null;
  created_at: string;
};

type OrderItem = {
  id: string;
  product_id: string | null;
  product_slug: string;
  product_title: string;
  variant_label: string | null;
  image_url: string | null;
  unit_price_cents: number;
  quantity: number;
  line_total_cents: number;
};

function Card({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-3xl border border-cream-300 bg-white p-6", className)}>
      <h2 className="font-display text-lg">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const [orderResult, itemsResult, eventsResult, emailResult, gatewayResult, customerResult] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, order_number, status, payment_status, payment_method, currency, subtotal_cents, " +
          "shipping_cents, discount_cents, total_cents, customer_name, customer_email, " +
          "customer_phone, shipping_line1, shipping_line2, shipping_city, shipping_district, " +
          "shipping_postal_code, shipping_country, customer_note, admin_note, tracking_number, created_at",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("order_items")
      .select(
        "id, product_id, product_slug, product_title, variant_label, image_url, " +
          "unit_price_cents, quantity, line_total_cents",
      )
      .eq("order_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("order_events")
      .select("id, from_status, to_status, actor_kind, note, created_at")
      .eq("order_id", id)
      .order("created_at", { ascending: false }),
    // email_log arrives with 0011; tolerate its absence so the page still
    // renders on a database that has not had that migration applied yet.
    supabase
      .from("email_log")
      .select("id, kind, recipient, subject, status, sent_at, created_at, error")
      .eq("order_id", id)
      .order("created_at", { ascending: true }),
    // The gateway columns arrive with 0012; same tolerance, and the reason this
    // is its own query rather than four more names in the select above.
    supabase
      .from("orders")
      .select("payment_gateway, payment_reference, payment_method_detail, paid_at")
      .eq("id", id)
      .maybeSingle(),
    // customer_id arrives with 0014; tolerated the same way.
    supabase.from("orders").select("customer_id").eq("id", id).maybeSingle(),
  ]);

  const customerId = customerResult.error
    ? null
    : ((customerResult.data as { customer_id: string | null } | null)?.customer_id ?? null);

  const gateway = (gatewayResult.error ? null : gatewayResult.data) as {
    payment_gateway: string | null;
    payment_reference: string | null;
    payment_method_detail: string | null;
    paid_at: string | null;
  } | null;

  const emails = (emailResult.error ? [] : (emailResult.data ?? [])) as EmailLogRow[];

  const order = orderResult.data as Order | null;
  if (!order) notFound();

  const items = (itemsResult.data ?? []) as unknown as OrderItem[];
  const events = (eventsResult.data ?? []) as unknown as OrderEvent[];
  const unitCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const nextStatuses = NEXT_STATUSES[order.status];
  // The latest refund reference, from the history (events are newest first).
  const refundNote =
    events.find((e) => e.note && /PayHere( refund| shows payment|: refunded)/i.test(e.note))?.note ?? null;
  const canCancel = CANCELLABLE_STATUSES.includes(order.status);

  const waText = `Hello ${order.customer_name.split(" ")[0]}, this is Franley about your order ${order.order_number}.`;

  return (
    <AdminPageShell
      title={`Order ${order.order_number}`}
      description={`Placed ${formatDateTime(order.created_at)} · ${unitCount} item${unitCount === 1 ? "" : "s"} · ${formatPrice(order.total_cents)}`}
    >
      <Link
        href="/admin/orders"
        className="inline-flex items-center gap-2 rounded-full text-xs text-ink-600 underline-offset-4 transition-colors hover:text-wine-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
        All orders
      </Link>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <OrderStatusBadge status={order.status} />
        <PaymentStatusBadge status={order.payment_status} />
        <span className="text-xs text-ink-600">{PAYMENT_METHOD_LABEL[order.payment_method]}</span>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.55fr_1fr] lg:items-start">
        <div className="space-y-6">
          <Card title="What they bought">
            {items.length === 0 ? (
              <p className="text-sm text-ink-600">
                This order has no line items on record, which should not be possible — check the
                database before acting on it.
              </p>
            ) : (
              <>
                <ul className="divide-y divide-cream-300 border-y border-cream-300">
                  {items.map((item) => (
                    <li key={item.id} className="flex gap-4 py-4">
                      <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-2xl border border-cream-300 bg-white">
                        {item.image_url ? (
                          <Image
                            src={item.image_url}
                            alt=""
                            fill
                            sizes="64px"
                            className="object-contain p-1.5"
                          />
                        ) : (
                          <span className="grid h-full w-full place-items-center text-ink-400">
                            <ImageOff className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                          </span>
                        )}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-display text-base text-ink-900">
                            {item.product_id ? (
                              <Link
                                href={`/products/${item.product_slug}`}
                                target="_blank"
                                className="underline-offset-4 hover:text-wine-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
                              >
                                {item.product_title}
                              </Link>
                            ) : (
                              item.product_title
                            )}
                          </p>
                          {item.variant_label && (
                            <p className="mt-0.5 text-xs text-ink-600">{item.variant_label}</p>
                          )}
                          <p className="mt-1.5 text-xs text-ink-600 tabular-nums">
                            {formatPrice(item.unit_price_cents)} × {item.quantity}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-medium tabular-nums text-ink-900">
                          {formatPrice(item.line_total_cents)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>

                <dl className="mt-5 ml-auto max-w-xs space-y-2.5 text-sm">
                  <div className="flex justify-between gap-6">
                    <dt className="text-ink-600">Subtotal</dt>
                    <dd className="tabular-nums">{formatPrice(order.subtotal_cents)}</dd>
                  </div>
                  <div className="flex justify-between gap-6">
                    <dt className="text-ink-600">Delivery</dt>
                    <dd className="tabular-nums">
                      {order.shipping_cents === 0 ? "Free" : formatPrice(order.shipping_cents)}
                    </dd>
                  </div>
                  {order.discount_cents > 0 && (
                    <div className="flex justify-between gap-6">
                      <dt className="text-ink-600">Discount</dt>
                      <dd className="tabular-nums">−{formatPrice(order.discount_cents)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-6 border-t border-cream-300 pt-3">
                    <dt className="font-display text-base">Total</dt>
                    <dd className="font-display text-base tabular-nums">
                      {formatPrice(order.total_cents)}
                    </dd>
                  </div>
                </dl>
              </>
            )}
          </Card>

          <Card title="Delivering to">
            <address className="text-sm not-italic leading-relaxed text-ink-800">
              {order.customer_name}
              <br />
              {order.shipping_line1}
              <br />
              {order.shipping_line2 && (
                <>
                  {order.shipping_line2}
                  <br />
                </>
              )}
              {order.shipping_city}
              {order.shipping_district && `, ${order.shipping_district}`}
              {order.shipping_postal_code && ` ${order.shipping_postal_code}`}
              <br />
              {order.shipping_country}
            </address>

            {order.customer_note && (
              <div className="mt-5 rounded-2xl bg-cream-100 px-4 py-3">
                <p className="eyebrow text-ink-600">Note from the customer</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-800">{order.customer_note}</p>
              </div>
            )}
          </Card>

          <Card title="History">
            <OrderTimeline events={events} />
          </Card>
        </div>

        <aside className="space-y-6">
          <Card title="Move this order along">
            <OrderStatusControls
              orderId={order.id}
              status={order.status}
              nextStatuses={nextStatuses}
            />
            {order.payment_method === "cod" && order.payment_status !== "paid" && (
              <p className="mt-4 border-t border-cream-300 pt-4 text-xs leading-relaxed text-ink-600">
                A cash-on-delivery order marks itself paid the moment you mark it delivered.
              </p>
            )}
          </Card>

          <Card title="Notifications">
            <EmailLog rows={emails} enabled={emailEnabled()} />
          </Card>

          <Card title="Payment">
            {order.payment_method === "card" && order.payment_status === "paid" && gateway?.payment_gateway === "payhere" && (
              <p className="mb-4 rounded-2xl bg-wine-700/[0.06] px-4 py-3 text-xs leading-relaxed text-wine-800">
                Marking this payment refunded below only records it — no money moves. To give the
                money back, use <strong>Refund via PayHere</strong> further down, or refund in the
                PayHere dashboard first.
              </p>
            )}
            <PaymentStatusControls
              orderId={order.id}
              paymentStatus={order.payment_status}
              paymentMethod={order.payment_method}
            />
            {gateway?.payment_reference && (
              <dl className="mt-4 space-y-1.5 border-t border-cream-300 pt-4 text-xs text-ink-600">
                <div className="flex justify-between gap-3">
                  <dt>PayHere payment ID</dt>
                  <dd className="font-mono text-ink-900">{gateway.payment_reference}</dd>
                </div>
                {gateway.payment_method_detail && (
                  <div className="flex justify-between gap-3">
                    <dt>Paid with</dt>
                    <dd className="text-ink-900">{gateway.payment_method_detail}</dd>
                  </div>
                )}
                {gateway.paid_at && (
                  <div className="flex justify-between gap-3">
                    <dt>Paid at</dt>
                    <dd className="text-ink-900">
                      {new Date(gateway.paid_at).toLocaleString("en-LK", { timeZone: "Asia/Colombo" })}
                    </dd>
                  </div>
                )}
              </dl>
            )}
            {order.payment_method === "card" && order.payment_status !== "paid" && order.payment_status !== "refunded" && (
              <p className="mt-4 border-t border-cream-300 pt-4 text-xs leading-relaxed text-ink-600">
                A card order marks itself paid when PayHere confirms the payment. Until then the
                customer has not been charged — do not dispatch it.
              </p>
            )}
            {order.payment_method === "card" &&
              order.payment_status === "paid" &&
              gateway?.payment_gateway === "payhere" &&
              gateway.payment_reference && (
                <RefundForm
                  orderId={order.id}
                  orderNumber={order.order_number}
                  totalCents={order.total_cents}
                  canCancel={canCancel}
                  shipped={order.status === "shipped"}
                  enabled={payhereRefundEnabled()}
                />
              )}
            {order.payment_method === "card" && order.payment_status === "refunded" && (
              <p className="mt-4 border-t border-cream-300 pt-4 text-xs leading-relaxed text-ink-600">
                {refundNote ? (
                  <>
                    <span className="text-ink-900">{refundNote}</span>
                    <br />
                  </>
                ) : null}
                A chargeback reported by PayHere also lands here automatically — if the order has not
                shipped, cancel it with restock.
              </p>
            )}
          </Card>

          <Card title="Customer">
            {customerId ? (
              <Link
                href={`/admin/customers/${customerId}`}
                className="text-sm text-ink-900 underline-offset-4 transition-colors hover:text-wine-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
              >
                {order.customer_name}
                <span className="ml-1.5 text-xs text-ink-600">— all their orders</span>
              </Link>
            ) : (
              <p className="text-sm text-ink-900">{order.customer_name}</p>
            )}
            <div className="mt-3 space-y-2 text-sm">
              <a
                href={`mailto:${order.customer_email}`}
                className="flex items-center gap-2 text-ink-600 underline-offset-4 transition-colors hover:text-wine-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
              >
                <Mail className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
                <span className="truncate">{order.customer_email}</span>
              </a>
              <a
                href={`tel:${order.customer_phone.replace(/[^0-9+]/g, "")}`}
                className="flex items-center gap-2 text-ink-600 underline-offset-4 transition-colors hover:text-wine-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
              >
                <Phone className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
                {order.customer_phone}
              </a>
            </div>
            <ButtonLink
              href={whatsappHref(order.customer_phone, waText)}
              target="_blank"
              rel="noreferrer"
              variant="outline"
              size="sm"
              className="mt-4 w-full"
            >
              <WhatsAppIcon className="h-4 w-4" />
              Message on WhatsApp
            </ButtonLink>
          </Card>

          <Card title="Tracking">
            <TrackingForm orderId={order.id} trackingNumber={order.tracking_number} />
          </Card>

          <Card title="Team note">
            <AdminNoteForm orderId={order.id} note={order.admin_note} />
          </Card>

          {canCancel && <OrderCancelForm orderId={order.id} />}
        </aside>
      </div>
    </AdminPageShell>
  );
}
