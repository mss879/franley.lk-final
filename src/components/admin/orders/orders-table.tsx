import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { formatDateTime } from "./format";
import { OrderStatusBadge, PaymentStatusBadge } from "./status-badge";
import {
  PAYMENT_METHOD_LABEL,
  type OrderStatus,
  type PaymentMethod,
  type PaymentStatus,
} from "./status";

export type OrderListRow = {
  id: string;
  order_number: string;
  created_at: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  total_cents: number;
  order_items: { quantity: number }[] | null;
};

export function itemCount(row: OrderListRow) {
  return (row.order_items ?? []).reduce((sum, item) => sum + item.quantity, 0);
}

const th = "eyebrow px-5 py-3.5 text-left font-medium text-ink-600";
const td = "px-5 py-4 align-middle";

export function OrdersTable({ rows }: { rows: OrderListRow[] }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-cream-300 bg-white">
      {/* Desktop: the scannable grid */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <caption className="sr-only">Orders, newest first</caption>
          <thead>
            <tr className="border-b border-cream-300 bg-cream-100">
              <th scope="col" className={th}>Order</th>
              <th scope="col" className={th}>Placed</th>
              <th scope="col" className={th}>Customer</th>
              <th scope="col" className={`${th} text-right`}>Items</th>
              <th scope="col" className={`${th} text-right`}>Total</th>
              <th scope="col" className={th}>Payment</th>
              <th scope="col" className={th}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-300">
            {rows.map((row) => (
              <tr key={row.id} className="transition-colors duration-200 hover:bg-cream-50">
                <th scope="row" className={`${td} text-left font-normal`}>
                  <Link
                    href={`/admin/orders/${row.id}`}
                    className="rounded-sm font-medium tabular-nums text-ink-900 underline-offset-4 hover:text-wine-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
                  >
                    {row.order_number}
                  </Link>
                </th>
                <td className={`${td} whitespace-nowrap text-ink-600`}>
                  {formatDateTime(row.created_at)}
                </td>
                <td className={td}>
                  <span className="block text-ink-800">{row.customer_name}</span>
                  <span className="block text-xs text-ink-600">{row.customer_email}</span>
                </td>
                <td className={`${td} text-right tabular-nums text-ink-600`}>{itemCount(row)}</td>
                <td className={`${td} text-right font-medium tabular-nums text-ink-900`}>
                  {formatPrice(row.total_cents)}
                </td>
                <td className={td}>
                  <span className="block text-xs text-ink-600">
                    {PAYMENT_METHOD_LABEL[row.payment_method]}
                  </span>
                  <PaymentStatusBadge status={row.payment_status} className="mt-1.5" />
                </td>
                <td className={td}>
                  <OrderStatusBadge status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: one tappable card per order */}
      <ul className="divide-y divide-cream-300 md:hidden">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              href={`/admin/orders/${row.id}`}
              className="flex items-start gap-4 p-5 transition-colors duration-200 hover:bg-cream-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium tabular-nums text-ink-900">{row.order_number}</span>
                  <OrderStatusBadge status={row.status} />
                </div>
                <p className="mt-2 truncate text-sm text-ink-800">{row.customer_name}</p>
                <p className="mt-0.5 text-xs text-ink-600">
                  {formatDateTime(row.created_at)} · {itemCount(row)} item
                  {itemCount(row) === 1 ? "" : "s"}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="font-medium tabular-nums text-ink-900">
                    {formatPrice(row.total_cents)}
                  </span>
                  <PaymentStatusBadge status={row.payment_status} />
                </div>
              </div>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-ink-400" strokeWidth={1.5} aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
