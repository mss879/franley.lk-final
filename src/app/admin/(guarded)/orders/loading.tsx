import { LoadingScreen, Skeleton } from "@/components/site/skeletons/skeleton";
import {
  AdminPageShellSkeleton,
  AdminStatsSkeleton,
  AdminTableSkeleton,
} from "@/components/site/skeletons/admin-skeletons";

const COLUMNS = [
  "w-24",
  "hidden w-32 md:flex",
  "flex-1",
  "hidden w-10 md:flex",
  "w-20",
  "hidden w-24 md:flex",
  "w-20",
];

export default function OrdersLoading() {
  return (
    <LoadingScreen label="Loading orders">
      <AdminPageShellSkeleton>
        <AdminStatsSkeleton />

        <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {["h-[34px] w-14", "h-[34px] w-20", "h-[34px] w-24", "h-[34px] w-20", "h-[34px] w-24"].map(
              (c, i) => (
                <Skeleton key={i} className={c} />
              ),
            )}
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
