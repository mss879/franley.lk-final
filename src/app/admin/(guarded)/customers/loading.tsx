import { LoadingScreen, Skeleton } from "@/components/site/skeletons/skeleton";
import {
  AdminPageShellSkeleton,
  AdminTableSkeleton,
} from "@/components/site/skeletons/admin-skeletons";

const COLUMNS = ["flex-1", "hidden w-32 md:flex", "w-12", "w-24", "hidden w-24 md:flex"];

export default function CustomersLoading() {
  return (
    <LoadingScreen label="Loading customers">
      <AdminPageShellSkeleton>
        {/* The one-line note about what spend counts */}
        <div className="flex h-4 items-center">
          <Skeleton className="h-2.5 w-full max-w-lg" />
        </div>

        {/* Three counters, not the orders page's four */}
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
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

        <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {["h-[34px] w-24", "h-[34px] w-24", "h-[34px] w-28", "h-[34px] w-20"].map((c, i) => (
              <Skeleton key={i} className={c} />
            ))}
          </div>
          <div className="flex w-full items-center gap-2 lg:w-auto">
            <Skeleton className="h-11 w-full lg:w-80" />
            <Skeleton className="h-11 w-24 shrink-0" />
          </div>
        </div>

        <AdminTableSkeleton columns={COLUMNS} rows={8} className="mt-6" />
      </AdminPageShellSkeleton>
    </LoadingScreen>
  );
}
