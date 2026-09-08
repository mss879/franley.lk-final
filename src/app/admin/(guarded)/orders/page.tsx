import type { Metadata } from "next";
import Link from "next/link";
import { ReceiptText, Search, X } from "lucide-react";
import { AdminPageShell } from "@/components/admin/page-shell";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { cn, formatPrice } from "@/lib/utils";
import { OrdersTable, type OrderListRow } from "@/components/admin/orders/orders-table";
import { OrderPagination } from "@/components/admin/orders/order-pagination";
import { ordersHref } from "@/components/admin/orders/links";
import { colomboDayStartISO, colomboMonthStartISO, monthLabel } from "@/components/admin/orders/format";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABEL,
  isOrderStatus,
} from "@/components/admin/orders/status";

export const metadata: Metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const SELECT =
  "id, order_number, created_at, customer_name, customer_email, customer_phone, " +
  "status, payment_status, payment_method, total_cents, order_items(quantity)";

const SEARCH_COLUMNS = ["order_number", "customer_name", "customer_email", "customer_phone"];

/** PostgREST parses the `or=(…)` filter itself, so the grammar's own
 *  punctuation must not survive inside the needle. */
function searchFilter(needle: string) {
  const safe = needle.replace(/[(),*%\\"']/g, " ").trim();
  if (!safe) return null;
  return SEARCH_COLUMNS.map((column) => `${column}.ilike.%${safe}%`).join(",");
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-cream-300 bg-white px-5 py-4">
      <p className="eyebrow text-ink-600">{label}</p>
      <p className="mt-2 font-display text-2xl tabular-nums text-ink-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-600">{hint}</p>}
    </div>
  );
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = params.status && isOrderStatus(params.status) ? params.status : undefined;
  const q = (params.q ?? "").trim().slice(0, 80);
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const from = (page - 1) * PAGE_SIZE;
  const filter = q ? searchFilter(q) : null;

  const supabase = await createClient();

  let rowsQuery = supabase
    .from("orders")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  // Counted separately so the pager stays correct even when `page` runs past
  // the end of the result set and the ranged read comes back empty.
  let countQuery = supabase.from("orders").select("id", { count: "exact", head: true });

  if (status) {
    rowsQuery = rowsQuery.eq("status", status);
    countQuery = countQuery.eq("status", status);
  }
  if (filter) {
    rowsQuery = rowsQuery.or(filter);
    countQuery = countQuery.or(filter);
  }

  const dayStart = colomboDayStartISO();
  const monthStart = colomboMonthStartISO();

  const [rowsResult, countResult, todayResult, pendingResult, unpaidResult, revenueResult] =
    await Promise.all([
      rowsQuery,
      countQuery,
      supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", dayStart),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("payment_status", "unpaid")
        .not("status", "in", '("cancelled","refunded")'),
      // PostgREST cannot SUM without an RPC, so the month's totals are added
      // up here. A month past the API's row cap would under-report.
      supabase
        .from("orders")
        .select("total_cents")
        .gte("created_at", monthStart)
        .neq("status", "cancelled"),
    ]);

  const rows = (rowsResult.data ?? []) as unknown as OrderListRow[];
  const total = countResult.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const revenueCents = ((revenueResult.data ?? []) as { total_cents: number }[]).reduce(
    (sum, order) => sum + order.total_cents,
    0,
  );
  const filtered = Boolean(status || q);
  const pastLastPage = rows.length === 0 && total > 0;
  const loadError = rowsResult.error ?? countResult.error;

  return (
    <AdminPageShell
      title="Orders"
      description="Every order placed on the storefront, newest first. Open one to move it along, add a tracking number or leave a note for the team."
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Orders today" value={String(todayResult.count ?? 0)} hint="Since midnight, Colombo" />
        <Stat label="Awaiting confirmation" value={String(pendingResult.count ?? 0)} hint="Still pending" />
        <Stat label="Unpaid" value={String(unpaidResult.count ?? 0)} hint="Live orders not yet paid" />
        <Stat
          label={`Revenue in ${monthLabel()}`}
          value={formatPrice(revenueCents)}
          hint="Excludes cancelled orders"
        />
      </div>

      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={ordersHref({ q })}
            aria-current={!status ? "page" : undefined}
            className={cn(
              "rounded-full border px-4 py-2 text-xs transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2",
              !status
                ? "border-wine-700 bg-wine-700 text-cream-50"
                : "border-cream-300 text-ink-600 hover:border-wine-700 hover:text-wine-700",
            )}
          >
            All
          </Link>
          {ORDER_STATUSES.map((value) => (
            <Link
              key={value}
              href={ordersHref({ status: value, q })}
              aria-current={status === value ? "page" : undefined}
              className={cn(
                "rounded-full border px-4 py-2 text-xs transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2",
                status === value
                  ? "border-wine-700 bg-wine-700 text-cream-50"
                  : "border-cream-300 text-ink-600 hover:border-wine-700 hover:text-wine-700",
              )}
            >
              {ORDER_STATUS_LABEL[value]}
            </Link>
          ))}
        </div>

        <form
          action="/admin/orders"
          method="get"
          role="search"
          className="flex w-full items-center gap-2 lg:w-auto"
        >
          {status && <input type="hidden" name="status" value={status} />}
          <div className="relative w-full lg:w-80">
            <label htmlFor="orders-search" className="sr-only">
              Search orders
            </label>
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
              strokeWidth={1.5}
              aria-hidden
            />
            <input
              id="orders-search"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Order number, name, email or phone"
              className="h-11 w-full rounded-full border border-cream-300 bg-white pl-11 pr-4 text-sm text-ink-800 placeholder:text-ink-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50"
            />
          </div>
          <Button type="submit" variant="outline" size="md">
            Search
          </Button>
        </form>
      </div>

      {q && (
        <p className="mt-4 flex items-center gap-2 text-xs text-ink-600">
          Matching <span className="text-ink-900">&ldquo;{q}&rdquo;</span>
          <Link
            href={ordersHref({ status })}
            className="inline-flex items-center gap-1 rounded-full border border-cream-300 px-3 py-1 transition-colors hover:border-wine-700 hover:text-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
          >
            <X className="h-3 w-3" strokeWidth={1.5} aria-hidden />
            Clear
          </Link>
        </p>
      )}

      <div className="mt-6">
        {loadError ? (
          <div className="rounded-3xl border border-cream-300 bg-cream-100 px-8 py-14 text-center">
            <h2 className="font-display text-2xl">Orders could not be loaded</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-600">
              {loadError.message}
            </p>
          </div>
        ) : rows.length > 0 ? (
          <>
            <OrdersTable rows={rows} />
            <OrderPagination
              page={page}
              pageCount={pageCount}
              first={from + 1}
              last={from + rows.length}
              total={total}
              status={status}
              q={q || undefined}
            />
          </>
        ) : (
          <div className="rounded-3xl border border-dashed border-cream-300 bg-cream-100 px-8 py-16 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-cream-300 bg-white text-ink-400">
              <ReceiptText className="h-5 w-5" strokeWidth={1.5} aria-hidden />
            </span>
            <h2 className="mt-5 font-display text-2xl">
              {pastLastPage
                ? "Nothing on this page"
                : filtered
                  ? "Nothing matches that"
                  : "No orders yet"}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-600">
              {pastLastPage
                ? `There are ${total} order${total === 1 ? "" : "s"} in this view, but none this far in.`
                : filtered
                  ? "Try a different status, or search by the full order number — FR-001042, say."
                  : "The first order placed on the storefront will appear here, with the customer's details and everything they bought."}
            </p>
            {(filtered || pastLastPage) && (
              <Link
                href={pastLastPage ? ordersHref({ status, q: q || undefined }) : ordersHref()}
                className="mt-6 inline-flex h-11 items-center rounded-full border border-ink-800/20 px-6 text-sm transition-colors hover:border-wine-700 hover:text-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
              >
                {pastLastPage ? "Back to the first page" : "Show all orders"}
              </Link>
            )}
          </div>
        )}
      </div>
    </AdminPageShell>
  );
}
