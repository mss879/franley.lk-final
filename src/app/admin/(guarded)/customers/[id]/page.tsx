import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { z } from "zod";
import { AdminPageShell } from "@/components/admin/page-shell";
import { ButtonLink } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/ui/social-icons";
import { createClient } from "@/lib/supabase/server";
import { cn, formatPrice } from "@/lib/utils";
import {
  ORDER_LIST_SELECT,
  OrdersTable,
  type OrderListRow,
} from "@/components/admin/orders/orders-table";
import { ordersHref } from "@/components/admin/orders/links";
import { formatDate, formatDateTime, whatsappHref } from "@/components/admin/orders/format";
import { CustomerNoteForm } from "@/components/admin/customers/customer-note-form";

export const metadata: Metadata = { title: "Customer" };
export const dynamic = "force-dynamic";

/** Beyond this the orders list, searched by email, is the better tool. */
const ORDERS_LIMIT = 100;

const idSchema = z.uuid();

type Customer = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  first_order_at: string | null;
  last_order_at: string | null;
  orders_count: number;
  total_spent_cents: number;
  notes: string | null;
  created_at: string;
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

const contactLink =
  "flex items-center gap-2 text-ink-600 underline-offset-4 transition-colors hover:text-wine-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();

  const supabase = await createClient();
  const [customerResult, ordersResult] = await Promise.all([
    supabase
      .from("customers")
      .select(
        "id, email, name, phone, first_order_at, last_order_at, orders_count, total_spent_cents, " +
          "notes, created_at",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("orders")
      .select(ORDER_LIST_SELECT)
      .eq("customer_id", id)
      .order("created_at", { ascending: false })
      .limit(ORDERS_LIMIT),
  ]);

  // A query failure is not a missing record: a 404 here would send the operator
  // hunting for a deleted customer when the table itself is what is missing.
  if (customerResult.error) throw new Error(customerResult.error.message);

  const customer = customerResult.data as Customer | null;
  if (!customer) notFound();

  const orders = (ordersResult.data ?? []) as unknown as OrderListRow[];
  const since = formatDate(customer.first_order_at ?? customer.created_at);
  const liveOrders = `${customer.orders_count} live order${customer.orders_count === 1 ? "" : "s"}`;

  const waText = `Hello ${customer.name.split(" ")[0]}, this is Franley.`;

  return (
    <AdminPageShell
      title={customer.name}
      description={`Customer since ${since} · ${liveOrders} · ${formatPrice(customer.total_spent_cents)} received`}
    >
      <Link
        href="/admin/customers"
        className="inline-flex items-center gap-2 rounded-full text-xs text-ink-600 underline-offset-4 transition-colors hover:text-wine-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
        All customers
      </Link>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.55fr_1fr] lg:items-start">
        <div className="space-y-6">
          <Card title="Their orders">
            {ordersResult.error ? (
              <p className="text-sm leading-relaxed text-ink-600">
                Orders could not be loaded: {ordersResult.error.message}
              </p>
            ) : orders.length === 0 ? (
              <p className="text-sm leading-relaxed text-ink-600">
                No orders are linked to this customer yet. Orders placed before the customers
                table existed are linked by the migration that created it.
              </p>
            ) : (
              <>
                <OrdersTable rows={orders} caption={`Orders by ${customer.name}, newest first`} />
                {orders.length >= ORDERS_LIMIT && (
                  <p className="mt-4 text-xs leading-relaxed text-ink-600">
                    Only the latest {ORDERS_LIMIT} are shown.{" "}
                    <Link
                      href={ordersHref({ q: customer.email })}
                      className="text-ink-900 underline underline-offset-4 transition-colors hover:text-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                    >
                      Search the orders list by their email
                    </Link>{" "}
                    for the rest.
                  </p>
                )}
              </>
            )}
          </Card>
        </div>

        <aside className="space-y-6">
          <Card title="Contact">
            <p className="text-sm text-ink-900">{customer.name}</p>
            <div className="mt-3 space-y-2 text-sm">
              <a href={`mailto:${customer.email}`} className={contactLink}>
                <Mail className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
                <span className="truncate">{customer.email}</span>
              </a>
              {customer.phone ? (
                <a href={`tel:${customer.phone.replace(/[^0-9+]/g, "")}`} className={contactLink}>
                  <Phone className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
                  {customer.phone}
                </a>
              ) : (
                <p className="flex items-center gap-2 text-ink-600">
                  <Phone className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
                  No phone number on file
                </p>
              )}
            </div>
            {customer.phone && (
              <ButtonLink
                href={whatsappHref(customer.phone, waText)}
                target="_blank"
                rel="noreferrer"
                variant="outline"
                size="sm"
                className="mt-4 w-full"
              >
                <WhatsAppIcon className="h-4 w-4" />
                Message on WhatsApp
              </ButtonLink>
            )}
          </Card>

          <Card title="At a glance">
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-6">
                <dt className="text-ink-600">Live orders</dt>
                <dd className="tabular-nums text-ink-900">{customer.orders_count}</dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt className="text-ink-600">Received</dt>
                <dd className="font-medium tabular-nums text-ink-900">
                  {formatPrice(customer.total_spent_cents)}
                </dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt className="text-ink-600">First order</dt>
                <dd className="text-right text-ink-900">{formatDateTime(customer.first_order_at)}</dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt className="text-ink-600">Last order</dt>
                <dd className="text-right text-ink-900">{formatDateTime(customer.last_order_at)}</dd>
              </div>
            </dl>
            <p className="mt-4 border-t border-cream-300 pt-4 text-xs leading-relaxed text-ink-600">
              Live orders leave out cancelled and refunded ones. Received is money that has
              actually arrived — a cash-on-delivery order counts once it is delivered.
            </p>
          </Card>

          <Card title="Team note">
            <CustomerNoteForm customerId={customer.id} notes={customer.notes} />
          </Card>
        </aside>
      </div>
    </AdminPageShell>
  );
}
