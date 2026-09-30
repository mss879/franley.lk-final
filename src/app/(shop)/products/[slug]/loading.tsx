import { LoadingScreen, Skeleton, SkeletonText } from "@/components/site/skeletons/skeleton";

export default function ProductLoading() {
  return (
    <LoadingScreen label="Loading this piece">
      <div className="mx-auto max-w-[1400px] px-5 py-10 md:px-10 md:py-14">
        <div className="mb-8 flex h-4 items-center gap-3">
          <Skeleton className="h-2.5 w-12" />
          <Skeleton className="h-2.5 w-12" />
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-2.5 w-36" />
        </div>

        <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          <div className="flex flex-col-reverse gap-4 md:flex-row">
            <div className="flex gap-3 md:flex-col">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-20 w-16 shrink-0 rounded-lg" />
              ))}
            </div>
            <div className="relative aspect-[4/5] flex-1 overflow-hidden rounded-2xl border border-cream-300 bg-white">
              <Skeleton className="absolute inset-6 rounded-xl" />
            </div>
          </div>

          <div className="lg:pt-6">
            <div className="flex h-4 items-center">
              <Skeleton className="h-2.5 w-24" />
            </div>
            <div className="mt-4 space-y-3">
              <Skeleton className="h-7 w-4/5 md:h-9" />
              <Skeleton className="h-7 w-2/5 md:h-9" />
            </div>
            <div className="mt-5 flex h-9 items-center">
              <Skeleton className="h-5 w-40" />
            </div>

            <SkeletonText lines={4} lineClassName="h-[1.62rem]" className="mt-6" />

            <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-cream-300 py-6">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i}>
                  <div className="flex h-4 items-center">
                    <Skeleton className="h-2 w-20" />
                  </div>
                  <div className="mt-1.5 flex h-5 items-center">
                    <Skeleton className="h-2.5 w-28" />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Skeleton className="h-[50px] sm:w-36" />
              <Skeleton className="h-14 flex-1" />
            </div>

            <div className="mt-8 space-y-3">
              {["w-64", "w-56", "w-72"].map((w) => (
                <div key={w} className="flex h-5 items-center gap-3">
                  <Skeleton className="h-4 w-4 shrink-0" />
                  <Skeleton className={`h-2.5 max-w-full ${w}`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </LoadingScreen>
  );
}
