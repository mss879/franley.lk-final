import { LoadingScreen } from "@/components/site/skeletons/skeleton";
import {
  PageHeaderSkeleton,
  ProductGridSkeleton,
  ShopFiltersSkeleton,
} from "@/components/site/skeletons/shop-skeletons";

export default function CollectionLoading() {
  return (
    <LoadingScreen label="Loading this collection">
      <PageHeaderSkeleton />
      <div className="mx-auto max-w-[1400px] px-5 py-12 md:px-10 md:py-16">
        <ShopFiltersSkeleton colors={5} />
        <div className="mt-12">
          <ProductGridSkeleton count={8} />
        </div>
      </div>
    </LoadingScreen>
  );
}
