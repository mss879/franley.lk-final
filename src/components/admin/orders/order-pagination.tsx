import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ordersHref } from "./links";
import type { OrderStatus } from "./status";

const step =
  "inline-flex h-10 items-center gap-2 rounded-full border border-cream-300 px-5 text-xs text-ink-800 " +
  "transition-colors duration-300 hover:border-wine-700 hover:text-wine-700 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2";

export function OrderPagination({
  page,
  pageCount,
  first,
  last,
  total,
  status,
  q,
}: {
  page: number;
  pageCount: number;
  /** 1-based index of the first and last order shown, for the count line. */
  first: number;
  last: number;
  total: number;
  status?: OrderStatus;
  q?: string;
}) {
  if (pageCount <= 1) {
    return (
      <p className="mt-5 text-xs text-ink-600">
        {total} order{total === 1 ? "" : "s"}
      </p>
    );
  }

  return (
    <nav
      aria-label="Orders pagination"
      className="mt-6 flex flex-wrap items-center justify-between gap-4"
    >
      <p className="text-xs text-ink-600">
        Showing {first}–{last} of {total} · page {page} of {pageCount}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={ordersHref({ status, q, page: page - 1 })} rel="prev" className={step}>
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
            Previous
          </Link>
        ) : (
          <span aria-disabled className={cn(step, "cursor-not-allowed opacity-40")}>
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
            Previous
          </span>
        )}
        {page < pageCount ? (
          <Link href={ordersHref({ status, q, page: page + 1 })} rel="next" className={step}>
            Next
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
          </Link>
        ) : (
          <span aria-disabled className={cn(step, "cursor-not-allowed opacity-40")}>
            Next
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
          </span>
        )}
      </div>
    </nav>
  );
}
