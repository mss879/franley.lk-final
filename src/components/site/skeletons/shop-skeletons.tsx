import { Skeleton, SkeletonText } from "./skeleton";

/** Mirrors `<PageHeader>` — the tinted cream band that opens every interior page. */
export function PageHeaderSkeleton({ lede = true }: { lede?: boolean }) {
  return (
    <section className="-mt-20 border-b border-cream-300 bg-cream-100 pt-20">
      <div className="mx-auto max-w-[1400px] px-5 py-14 md:px-10 md:py-20">
        <div className="flex h-4 items-center gap-3">
          <Skeleton className="h-px w-8" />
          <Skeleton className="h-2.5 w-28" />
        </div>
        <div className="mt-5 flex h-[clamp(2.5rem,6vw,4.25rem)] items-center">
          <Skeleton className="h-[clamp(1.5rem,3.6vw,2.5rem)] w-[min(30rem,72%)]" />
        </div>
        {lede && (
          <SkeletonText
            lines={2}
            lineClassName="h-[1.42rem] md:h-[1.63rem]"
            className="mt-5 max-w-xl"
          />
        )}
      </div>
    </section>
  );
}

/** Mirrors `<ShopFilters>`: category pills, colour pills, count and sort. */
export function ShopFiltersSkeleton({ colors = 6 }: { colors?: number }) {
  return (
    <div className="flex flex-col gap-6 border-b border-cream-300 pb-6">
      <div className="flex flex-wrap items-center gap-2">
        {["h-[34px] w-14", "h-[34px] w-24", "h-[34px] w-28", "h-[34px] w-32"].map((c) => (
          <Skeleton key={c} className={c} />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-1 flex h-4 items-center">
            <Skeleton className="h-2.5 w-12" />
          </div>
          {Array.from({ length: colors }, (_, i) => (
            <Skeleton key={i} className="h-[30px] w-16" />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-[34px] w-36" />
        </div>
      </div>
    </div>
  );
}

/** Mirrors `<ProductGrid>` cell for cell: frame, eyebrow, title, price. */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-12 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col">
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-cream-300 bg-white">
            <Skeleton className="absolute inset-4 rounded-xl" />
          </div>
          <div className="mt-4 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex h-4 items-center">
                <Skeleton className="h-2.5 w-20" />
              </div>
              <div className="mt-1 flex h-[1.375rem] items-center">
                <Skeleton className="h-3 w-4/5" />
              </div>
            </div>
            <Skeleton className="mt-1 h-4 w-4 shrink-0" />
          </div>
          <div className="mt-1.5 flex h-5 items-center">
            <Skeleton className="h-2.5 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
