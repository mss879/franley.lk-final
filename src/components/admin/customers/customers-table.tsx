import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { formatDate } from "@/components/admin/orders/format";

/** One row of `customers`, as the list selects it. `total_spent_cents` is a
 *  bigint in Postgres but arrives as a plain number — no shop will get within
 *  sight of 2^53 cents. */
export type CustomerListRow = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  orders_count: number;
  total_spent_cents: number;
  first_order_at: string | null;
  last_order_at: string | null;
};

const th = "eyebrow px-5 py-3.5 text-left font-medium text-ink-600";
const td = "px-5 py-4 align-middle";

export function CustomersTable({ rows }: { rows: CustomerListRow[] }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-cream-300 bg-white">
      {/* Desktop: the scannable grid */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <caption className="sr-only">Customers</caption>
          <thead>
            <tr className="border-b border-cream-300 bg-cream-100">
              <th scope="col" className={th}>Customer</th>
              <th scope="col" className={th}>Phone</th>
              <th scope="col" className={`${th} text-right`}>Orders</th>
              <th scope="col" className={`${th} text-right`}>Spent</th>
              <th scope="col" className={th}>Last order</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-300">
            {rows.map((row) => (
              <tr key={row.id} className="transition-colors duration-200 hover:bg-cream-50">
                <th scope="row" className={`${td} text-left font-normal`}>
                  <Link
                    href={`/admin/customers/${row.id}`}
                    className="rounded-sm font-medium text-ink-900 underline-offset-4 hover:text-wine-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
                  >
                    {row.name}
                  </Link>
                  <span className="block text-xs text-ink-600">{row.email}</span>
                </th>
                <td className={`${td} whitespace-nowrap text-ink-600`}>{row.phone ?? "—"}</td>
                <td className={`${td} text-right tabular-nums text-ink-600`}>{row.orders_count}</td>
                <td className={`${td} text-right font-medium tabular-nums text-ink-900`}>
                  {formatPrice(row.total_spent_cents)}
                </td>
                <td className={`${td} whitespace-nowrap text-ink-600`}>
                  {formatDate(row.last_order_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: one tappable card per customer */}
      <ul className="divide-y divide-cream-300 md:hidden">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              href={`/admin/customers/${row.id}`}
              className="flex items-start gap-4 p-5 transition-colors duration-200 hover:bg-cream-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink-900">{row.name}</p>
                <p className="mt-0.5 truncate text-xs text-ink-600">{row.email}</p>
                {row.phone && <p className="mt-0.5 text-xs text-ink-600">{row.phone}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-600">
                  <span className="font-medium tabular-nums text-ink-900">
                    {formatPrice(row.total_spent_cents)}
                  </span>
                  <span className="tabular-nums">
                    {row.orders_count} order{row.orders_count === 1 ? "" : "s"}
                  </span>
                  <span>Last {formatDate(row.last_order_at)}</span>
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
