import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/site/page-header";
import { ProductGrid } from "@/components/shop/product-grid";
import { ShopFilters } from "@/components/shop/shop-filters";
import { getProducts, getCategories, getCategoryBySlug } from "@/lib/data";
import {
  JsonLd,
  activeColors,
  breadcrumbJsonLd,
  buildMetadata,
  collectionJsonLd,
  listingCanonical,
  type ListingParams,
} from "@/lib/seo";
import type { ProductQuery } from "@/types/domain";

export const revalidate = 60;

export async function generateStaticParams() {
  return (await getCategories()).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<ListingParams>;
}): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const category = await getCategoryBySlug(slug);
  if (!category) {
    return buildMetadata({ title: "Collection", canonical: `/collections/${slug}`, noindex: true });
  }

  const colors = activeColors(sp);
  const oneColour = colors.length === 1 ? colors[0] : null;

  return buildMetadata({
    title: oneColour ? `${oneColour} ${category.name}` : category.name,
    description: oneColour
      ? `${category.name} in ${oneColour.toLowerCase()} from Franley. ${category.description ?? ""}`.trim()
      : (category.description ?? undefined),
    canonical: listingCanonical(`/collections/${slug}`, sp),
  });
}

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<ListingParams>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const colorFilter = activeColors(sp);

  const [{ products, total }, categories, inCat] = await Promise.all([
    getProducts({
      categorySlug: slug,
      sort: (sp.sort as ProductQuery["sort"]) ?? "newest",
      colors: colorFilter.length ? colorFilter : undefined,
    }),
    getCategories(),
    getProducts({ categorySlug: slug }),
  ]);

  const colors = [...new Set(inCat.products.map((p) => p.colorName).filter(Boolean) as string[])].sort();

  const path = listingCanonical(`/collections/${slug}`, sp);

  return (
    <>
      <JsonLd
        data={collectionJsonLd({
          name: category.name,
          description: category.description,
          path,
          products,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Shop", path: "/shop" },
          { name: category.name, path: `/collections/${slug}` },
        ])}
      />

      <PageHeader eyebrow="Collection" title={category.name} lede={category.description ?? undefined} />
      <div className="mx-auto max-w-[1400px] px-5 py-12 md:px-10 md:py-16">
        <ShopFilters
          categories={categories}
          activeCategory={slug}
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
