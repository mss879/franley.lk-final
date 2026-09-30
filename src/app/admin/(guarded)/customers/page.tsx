import type { Metadata } from "next";
import Link from "next/link";
import { Search, Users, X } from "lucide-react";
import { AdminPageShell } from "@/components/admin/page-shell";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { CustomersTable, type CustomerListRow } from "@/components/admin/customers/customers-table";
import { OrderPagination } from "@/components/admin/orders/order-pagination";
import { colomboMonthStartISO, monthLabel } from "@/components/admin/orders/format";
import {
  CUSTOMER_SORTS,
  CUSTOMER_SORT_LABEL,
  DEFAULT_CUSTOMER_SORT,
  customersHref,
  isCustomerSort,
  type CustomerSort,
} from "@/components/admin/customers/links";

export const metadata: Metadata = { title: "Customers" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const SELECT =
  "id, email, name, phone, orders_count, total_spent_cents, first_order_at, last_order_at";

const SEARCH_COLUMNS = ["name", "email", "phone"];

/** PostgREST parses the `or=(…)` filter itself, so the grammar's own
 *  punctuation must not survive inside the needle. Same rule as the orders list. */
function searchFilter(needle: string) {
  const safe = needle.replace(/[(),*%\\"']/g, " ").trim();
  if (!safe) return null;
  return SEARCH_COLUMNS.map((column) => `${column}.ilike.%${safe}%`).join(",");
}

/** The ties on spend and order count are broken by recency, and every sort
 *  ends on `id` so a page boundary never falls between two equal rows. */
const SORT_ORDER: Record<CustomerSort, { column: string; ascending: boolean }[]> = {
  last: [{ column: "last_order_at", ascending: false }],
  spend: [
    { column: "total_spent_cents", ascending: false },
    { column: "last_order_at", ascending: false },
  ],
  orders: [
    { column: "orders_count", ascending: false },
    { column: "last_order_at", ascending: false },
  ],
  name: [{ column: "name", ascending: true }],
};

/** A repeated key arrives as an array; the first value is the one meant. */
function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
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

const pill =
  "rounded-full border px-4 py-2 text-xs transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; sort?: string | string[]; page?: string | string[] }>;
}) {
  const params = await searchParams;
  const requestedSort = single(params.sort) ?? "";
  const sort: CustomerSort = isCustomerSort(requestedSort) ? requestedSort : DEFAULT_CUSTOMER_SORT;
  const q = (single(params.q) ?? "").trim().slice(0, 80);
  const requestedPage = Number.parseInt(single(params.page) ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const from = (page - 1) * PAGE_SIZE;
  const filter = q ? searchFilter(q) : null;

  const supabase = await createClient();

  let rowsQuery = supabase.from("customers").select(SELECT);
  for (const { column, ascending } of SORT_ORDER[sort]) {
    // A customer whose orders were all cancelled has no last order; they belong
    // at the end whichever way the column is sorted.
    rowsQuery = rowsQuery.order(column, { ascending, nullsFirst: false });
  }
  rowsQuery = rowsQuery.order("id", { ascending: true }).range(from, from + PAGE_SIZE - 1);
  // Counted separately so the pager stays correct even when `page` runs past
  // the end of the result set and the ranged read comes back empty.
  let countQuery = supabase.from("customers").select("id", { count: "exact", head: true });

  if (filter) {
    rowsQuery = rowsQuery.or(filter);
    countQuery = countQuery.or(filter);
  }

  const monthStart = colomboMonthStartISO();

  const [rowsResult, countResult, allResult, newResult, repeatResult] = await Promise.all([
    rowsQuery,
    countQuery,
    supabase.from("customers").select("id", { count: "exact", head: true }),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .gte("first_order_at", monthStart),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .gte("orders_count", 2),
  ]);

  const rows = (rowsResult.data ?? []) as unknown as CustomerListRow[];
  const total = countResult.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pastLastPage = rows.length === 0 && total > 0;
  const loadError = rowsResult.error ?? countResult.error;

  return (
    <AdminPageShell
      title="Customers"
      description="Everyone who has placed an order, with what they have spent and how to reach them. Open one for their orders and a note for the team."
    >
      <p className="max-w-2xl text-xs leading-relaxed text-ink-600">
        Spend counts money actually received — cash-on-delivery orders count once delivered.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Stat label="Customers" value={String(allResult.count ?? 0)} hint="Everyone who has ordered" />
        <Stat
          label={`New in ${monthLabel()}`}
          value={String(newResult.count ?? 0)}
          hint="First order this month, Colombo time"
        />
        <Stat label="Repeat" value={String(repeatResult.count ?? 0)} hint="Two or more live orders" />
      </div>

      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Sort customers">
          {CUSTOMER_SORTS.map((value) => (
            <Link
              key={value}
              href={customersHref({ sort: value, q })}
              aria-current={sort === value ? "page" : undefined}
              className={cn(
                pill,
                sort === value
                  ? "border-ink-900 bg-ink-900 text-cream-50"
                  : "border-cream-300 text-ink-600 hover:border-wine-700 hover:text-wine-700",
              )}
            >
              {CUSTOMER_SORT_LABEL[value]}
            </Link>
          ))}
        </div>

        <form
          action="/admin/customers"
          method="get"
          role="search"
          className="flex w-full items-center gap-2 lg:w-auto"
        >
          {sort !== DEFAULT_CUSTOMER_SORT && <input type="hidden" name="sort" value={sort} />}
          <div className="relative w-full lg:w-80">
            <label htmlFor="customers-search" className="sr-only">
              Search customers
            </label>
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
              strokeWidth={1.5}
              aria-hidden
            />
            <input
              id="customers-search"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Name, email or phone"
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
            href={customersHref({ sort })}
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
            <h2 className="font-display text-2xl">Customers could not be loaded</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-600">
              {loadError.message}
            </p>
            <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-ink-600">
              The customers table arrives with{" "}
              <code className="rounded bg-cream-200 px-1.5 py-0.5">
                supabase/migrations/0014_customers.sql
              </code>
              . If that has not been applied to this project yet, run it and refresh.
            </p>
          </div>
        ) : rows.length > 0 ? (
          <>
            <CustomersTable rows={rows} />
            <OrderPagination
              page={page}
              pageCount={pageCount}
              first={from + 1}
              last={from + rows.length}
              total={total}
              noun="customer"
              hrefFor={(target) => customersHref({ q: q || undefined, sort, page: target })}
            />
          </>
        ) : (
          <div className="rounded-3xl border border-dashed border-cream-300 bg-cream-100 px-8 py-16 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-cream-300 bg-white text-ink-400">
              <Users className="h-5 w-5" strokeWidth={1.5} aria-hidden />
            </span>
            <h2 className="mt-5 font-display text-2xl">
              {pastLastPage ? "Nothing on this page" : q ? "Nothing matches that" : "No customers yet"}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-600">
              {pastLastPage
                ? `There are ${total} customer${total === 1 ? "" : "s"} in this view, but none this far in.`
                : q
                  ? "Try part of a name, an email address or a phone number."
                  : "Everyone who places an order is added here automatically, with what they have spent and how to reach them."}
            </p>
            {(q || pastLastPage) && (
              <Link
                href={pastLastPage ? customersHref({ q: q || undefined, sort }) : customersHref({ sort })}
                className="mt-6 inline-flex h-11 items-center rounded-full border border-ink-800/20 px-6 text-sm transition-colors hover:border-wine-700 hover:text-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
              >
                {pastLastPage ? "Back to the first page" : "Show all customers"}
              </Link>
            )}
          </div>
        )}
      </div>
    </AdminPageShell>
  );
}
