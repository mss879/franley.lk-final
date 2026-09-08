import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

/** Mirrors `<AdminPageShell>`'s title block and content offset. */
export function AdminPageShellSkeleton({
  action = false,
  children,
}: {
  action?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1200px] px-5 py-8 md:px-8 md:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full">
          <div className="flex h-9 items-center">
            <Skeleton className="h-5 w-44" />
          </div>
          <div className="mt-2 max-w-xl space-y-2">
            <Skeleton className="h-2.5 w-full" />
            <Skeleton className="h-2.5 w-2/3" />
          </div>
        </div>
        {action && <Skeleton className="h-11 w-36 shrink-0" />}
      </div>
      <div className="mt-8">{children}</div>
    </div>
  );
}

/** The four counters above the orders list. */
export function AdminStatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-2xl border border-cream-300 bg-white px-5 py-4">
          <div className="flex h-4 items-center">
            <Skeleton className="h-2.5 w-24" />
          </div>
          <div className="mt-2 flex h-8 items-center">
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="mt-1 flex h-4 items-center">
            <Skeleton className="h-2 w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * A stand-in for the admin data tables. `columns` holds one width class per
 * column so the bars line up with the real header cells.
 */
export function AdminTableSkeleton({
  columns,
  rows = 8,
  rowHeight = "h-9",
  className,
}: {
  columns: string[];
  rows?: number;
  /** Height of one row's content box, before the row padding. */
  rowHeight?: string;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-3xl border border-cream-300 bg-white", className)}>
      <div className="flex items-center gap-4 border-b border-cream-300 bg-cream-100 px-5 py-3.5">
        {columns.map((width, i) => (
          <div key={i} className={cn("flex h-4 items-center", width)}>
            <Skeleton className="h-2 w-full" />
          </div>
        ))}
      </div>
      <div className="divide-y divide-cream-300">
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} className="flex items-center gap-4 px-5 py-4">
            {columns.map((width, i) => (
              <div key={i} className={cn("flex items-center", rowHeight, width)}>
                <Skeleton className="h-2.5 w-full" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
