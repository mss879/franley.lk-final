import type { Metadata } from "next";
import { PageHeader } from "@/components/site/page-header";
import { ProductGrid } from "@/components/shop/product-grid";
import { ShopFilters } from "@/components/shop/shop-filters";
import { getProducts, getCategories } from "@/lib/data";
import {
  JsonLd,
  activeColors,
  breadcrumbJsonLd,
  buildMetadata,
  collectionJsonLd,
  isSearch,
  listingCanonical,
  type ListingParams,
} from "@/lib/seo";
import type { ProductQuery } from "@/types/domain";

export const revalidate = 60;

/** Copy for the three shapes this page takes: the full range, one colour, a search. */
function describe(sp: ListingParams) {
  const colors = activeColors(sp);
  if (isSearch(sp)) {
    const term = sp.q!.trim();
    return {
      title: `Search results for “${term}”`,
      description: `Franley neckties and cufflink sets matching “${term}”.`,
    };
  }
  if (colors.length === 1) {
    return {
      title: `${colors[0]} Neckties`,
      description: `Every Franley necktie in ${colors[0].toLowerCase()} — woven silk-finish, cut to a modern blade. Rs 1,190, delivered island-wide in Sri Lanka.`,
    };
  }
  return {
    title: "Shop All",
    description:
      "Every Franley necktie and cufflink set in one place — silk-finish ties at Rs 1,190, gift-boxed cufflinks at Rs 1,790, delivered island-wide in Sri Lanka.",
  };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<ListingParams>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const { title, description } = describe(sp);
  return buildMetadata({
    title,
    description,
    canonical: listingCanonical("/shop", sp),
    // Search pages keep a self-referencing canonical; the noindex does the work.
    noindex: isSearch(sp),
  });
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<ListingParams>;
}) {
  const sp = await searchParams;
  const colorFilter = activeColors(sp);

  const [{ products, total }, categories, all] = await Promise.all([
    getProducts({
      sort: (sp.sort as ProductQuery["sort"]) ?? "newest",
      colors: colorFilter.length ? colorFilter : undefined,
      search: sp.q,
    }),
    getCategories(),
    getProducts({}),
  ]);

  const colors = [...new Set(all.products.map((p) => p.colorName).filter(Boolean) as string[])].sort();

  const { title, description } = describe(sp);

  return (
    <>
      <JsonLd
        data={collectionJsonLd({
          name: title,
          description,
          path: listingCanonical("/shop", sp),
          products,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Shop", path: "/shop" },
        ])}
      />

      <PageHeader
        eyebrow="The full range"
        title="Shop All Products"
        lede="Woven silk-finish neckties and finishing pieces, all cut and hand-finished to the same standard."
      />
      <div className="mx-auto max-w-[1400px] px-5 py-12 md:px-10 md:py-16">
        <ShopFilters
          categories={categories}
          colors={colors}
          activeColors={colorFilter}
          total={total}
        />
        <div className="mt-12">
          {/* Without this the outline skips h1 -> h3 (ProductCard's title). */}
          <h2 className="sr-only">Products</h2>
          <ProductGrid products={products} />
        </div>
      </div>
    </>
  );
}
