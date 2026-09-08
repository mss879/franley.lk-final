import { LoadingScreen } from "@/components/site/skeletons/skeleton";
import {
  PageHeaderSkeleton,
  ProductGridSkeleton,
  ShopFiltersSkeleton,
} from "@/components/site/skeletons/shop-skeletons";

export default function ShopLoading() {
  return (
    <LoadingScreen label="Loading the collection">
      <PageHeaderSkeleton />
      <div className="mx-auto max-w-[1400px] px-5 py-12 md:px-10 md:py-16">
        <ShopFiltersSkeleton colors={8} />
        <div className="mt-12">
          <ProductGridSkeleton count={12} />
        </div>
      </div>
    </LoadingScreen>
  );
}
