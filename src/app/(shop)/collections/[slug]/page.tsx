import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PageHeader } from "@/components/site/page-header";
import { ProductGrid } from "@/components/shop/product-grid";
import { ShopFilters } from "@/components/shop/shop-filters";
import {
  getCategories,
  getCategoryBySlug,
  getCollectionBySlug,
  getCollections,
  getProducts,
} from "@/lib/data";
import {
  collectionSort,
  listingParams,
  shopSort,
  type RawSearchParams,
} from "@/lib/listing-params";
import {
  JsonLd,
  activeColors,
  breadcrumbJsonLd,
  buildMetadata,
  collectionJsonLd,
  listingCanonical,
  listingNoindex,
} from "@/lib/seo";
import type { Category, Collection } from "@/types/domain";
import { CollectionFilters } from "../collection-filters";
import { CollectionImage, collectionImageSrc } from "../collection-image";

export const revalidate = 60;

/**
 * One address, two kinds of page. A curated collection wins; otherwise the
 * slug is a category, which is what every /collections link on the site,
 * in the CMS and in next.config's redirects pointed at before collections
 * existed. The database keeps the two slug sets disjoint. A collection with
 * no active products resolves to nothing (see getCollectionBySlug), so its
 * page 404s until it has something to show.
 */
type Resolved =
  | { kind: "collection"; collection: Collection }
  | { kind: "category"; category: Category }
  | null;

const resolveSlug = cache(async (slug: string): Promise<Resolved> => {
  const [collection, category] = await Promise.all([
    getCollectionBySlug(slug),
    getCategoryBySlug(slug),
  ]);
  if (collection) return { kind: "collection", collection };
  if (category) return { kind: "category", category };
  return null;
});

export async function generateStaticParams() {
  const [collections, categories] = await Promise.all([getCollections(), getCategories()]);
  const slugs = new Set([...collections, ...categories].map((row) => row.slug));
  return [...slugs].map((slug) => ({ slug }));
}

/**
 * Listing descriptions are one short line in the admin ("Silk-finish ties in
 * solid colours."), well under what a search result shows. Short ones get the
 * delivery promise every listing shares, so the snippet is not half empty.
 */
function listingDescription(name: string, description: string | null) {
  const base = description?.trim() || `Shop ${name} from Franley.`;
  if (base.length >= 110) return base;
  return `${/[.!?]$/.test(base) ? base : `${base}.`} Delivered island-wide across Sri Lanka, with cash on delivery available.`;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
}): Promise<Metadata> {
  const [{ slug }, raw] = await Promise.all([params, searchParams]);
  const sp = listingParams(raw);
  const resolved = await resolveSlug(slug);
  if (!resolved) {
    return buildMetadata({ title: "Collection", canonical: `/collections/${slug}`, noindex: true });
  }

  const { name, description, imageUrl } =
    resolved.kind === "collection" ? resolved.collection : resolved.category;
  const colors = activeColors(sp);
  const oneColour = colors.length === 1 ? colors[0] : null;

  return buildMetadata({
    title: oneColour ? `${oneColour} ${name}` : name,
    description: oneColour
      ? `${name} in ${oneColour.toLowerCase()} from Franley. ${description ?? ""}`.trim()
      : listingDescription(name, description),
    canonical: listingCanonical(`/collections/${slug}`, sp),
    noindex: listingNoindex(sp),
    // The hero doubles as the share card; a bare storage key is expanded first.
    ...(imageUrl ? { images: [collectionImageSrc(imageUrl)], imageAlt: name } : {}),
  });
}

/** Every colour present in the unfiltered listing, so a filter never hides its own pill. */
function colourOptions(products: { colorName: string | null }[]) {
  return [...new Set(products.map((p) => p.colorName).filter(Boolean) as string[])].sort();
}

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const [{ slug }, raw] = await Promise.all([params, searchParams]);
  const sp = listingParams(raw);
  const resolved = await resolveSlug(slug);
  if (!resolved) notFound();

  const colorFilter = activeColors(sp);
  const path = listingCanonical(`/collections/${slug}`, sp);

  if (resolved.kind === "collection") {
    const { collection } = resolved;
    const sort = collectionSort(sp.sort);

    const [{ products, total }, categories, unfiltered] = await Promise.all([
      getProducts({
        collectionSlug: slug,
        sort,
        colors: colorFilter.length ? colorFilter : undefined,
      }),
      getCategories(),
      getProducts({ collectionSlug: slug }),
    ]);

    return (
      <>
        <JsonLd
          data={collectionJsonLd({
            name: collection.name,
            description: collection.description,
            path,
            products,
          })}
        />
        <JsonLd
          data={breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Collections", path: "/collections" },
            { name: collection.name, path: `/collections/${slug}` },
          ])}
        />

        <PageHeader
          eyebrow={collection.heroEyebrow ?? "Collection"}
          title={collection.name}
          lede={collection.description ?? undefined}
        />

        {collection.imageUrl && (
          // Pulled up into the burgundy band, the way the reference boards
          // overlap an editorial image with the panel above it.
          <div className="mx-auto max-w-[1400px] px-5 md:px-10">
            <div className="relative -mt-8 aspect-[4/3] overflow-hidden rounded-3xl bg-ink-900 md:-mt-12 md:aspect-[21/9]">
              <CollectionImage
                url={collection.imageUrl}
                alt=""
                priority
                sizes="(max-width: 1480px) 100vw, 1400px"
                className="object-cover"
              />
            </div>
          </div>
        )}

        <div className="mx-auto max-w-[1400px] px-5 py-12 md:px-10 md:py-16">
          <CollectionFilters
            categories={categories}
            colors={colourOptions(unfiltered.products)}
            activeColors={colorFilter}
            activeSort={sort}
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

  const { category } = resolved;

  const [{ products, total }, categories, inCat] = await Promise.all([
    getProducts({
      categorySlug: slug,
      sort: shopSort(sp.sort),
      colors: colorFilter.length ? colorFilter : undefined,
    }),
    getCategories(),
    getProducts({ categorySlug: slug }),
  ]);

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
          colors={colourOptions(inCat.products)}
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
