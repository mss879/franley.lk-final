import { LoadingScreen, Skeleton } from "@/components/site/skeletons/skeleton";
import {
  AdminPageShellSkeleton,
  AdminTableSkeleton,
} from "@/components/site/skeletons/admin-skeletons";

const COLUMNS = [
  "w-11",
  "flex-1",
  "hidden w-28 md:flex",
  "w-20",
  "hidden w-16 md:flex",
  "hidden w-20 md:flex",
  "w-16",
];

export default function ProductsLoading() {
  return (
    <LoadingScreen label="Loading products">
      <AdminPageShellSkeleton action>
        <div className="h-[92px] rounded-3xl border border-cream-300 bg-white" />

        <div className="mt-4 flex h-4 items-center">
          <Skeleton className="h-2.5 w-56" />
        </div>

        <AdminTableSkeleton columns={COLUMNS} rows={10} rowHeight="h-12" className="mt-4" />
      </AdminPageShellSkeleton>
    </LoadingScreen>
  );
}
