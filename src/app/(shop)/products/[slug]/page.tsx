import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Truck, RefreshCw, MessageCircle } from "lucide-react";
import { ProductGallery } from "@/components/shop/product-gallery";
import { AddToBag } from "@/components/shop/add-to-bag";
import { ProductGrid } from "@/components/shop/product-grid";
import { SectionHeading } from "@/components/ui/section-heading";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getProductBySlug, getProducts, getAllProductSlugs } from "@/lib/data";
import { formatPrice } from "@/lib/utils";
import { DELIVERY } from "@/lib/constants";
import { getSiteSettings } from "@/lib/settings";
import {
  JsonLd,
  ProductOpenGraph,
  breadcrumbJsonLd,
  buildMetadata,
  productJsonLd,
  productSeoDescription,
  productSeoTitle,
} from "@/lib/seo";

export const revalidate = 60;

export async function generateStaticParams() {
  return (await getAllProductSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) {
    return buildMetadata({ title: "Not found", canonical: `/products/${slug}`, noindex: true });
  }
  return buildMetadata({
    title: productSeoTitle(product),
    description: productSeoDescription(product),
    canonical: `/products/${product.slug}`,
    images: product.images,
    imageAlt: product.title,
    ogType: "none",
  });
}

// Derived, not hardcoded: these two used to be string literals that would
// silently drift from /shipping and /returns. The policy is a RETURN within
// DELIVERY.returnsWindow days; exchanges are conditional on stock (see
// src/app/(shop)/returns/page.tsx), so the copy says returns.
const promises = (freeThresholdCents: number) => [
  { Icon: Truck, text: `Islandwide delivery, free over ${formatPrice(freeThresholdCents)}` },
  { Icon: RefreshCw, text: `${DELIVERY.returnsWindow}-day returns on unused pieces` },
  { Icon: MessageCircle, text: "WhatsApp support before and after you buy" },
];

/**
 * Care copy by category. Every product page printed "Dry clean only", including
 * the cufflink and tie-clip sets, which are metal in a gift box.
 */
const CARE_BY_CATEGORY: Record<string, string> = {
  cufflinks: "Wipe with a soft, dry cloth",
};
const DEFAULT_CARE = "Dry clean only";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [product, settings] = await Promise.all([getProductBySlug(slug), getSiteSettings()]);
  if (!product) notFound();

  const { products: related } = await getProducts({
    categorySlug: product.categorySlug,
    excludeSlug: product.slug,
    limit: 4,
  });

  const onSale = product.compareAtCents != null && product.compareAtCents > product.priceCents;

  const path = `/products/${product.slug}`;
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "Shop", path: "/shop" },
    ...(product.categoryName
      ? [{ name: product.categoryName, path: `/collections/${product.categorySlug}` }]
      : []),
    { name: product.title, path },
  ];

  return (
    <>
      <ProductOpenGraph product={product} />
      <JsonLd data={productJsonLd(product, path, settings)} />
      <JsonLd data={breadcrumbJsonLd(crumbs)} />

      <div className="mx-auto max-w-[1400px] px-5 py-10 md:px-10 md:py-14">
        <nav aria-label="Breadcrumb" className="mb-8 text-xs text-ink-600">
          <ol className="flex flex-wrap items-center gap-2">
            <li><Link href="/" className="hover:text-wine-700">Home</Link></li>
            <li aria-hidden>/</li>
            <li><Link href="/shop" className="hover:text-wine-700">Shop</Link></li>
            {product.categoryName && (
              <>
                <li aria-hidden>/</li>
                <li>
                  <Link href={`/collections/${product.categorySlug}`} className="hover:text-wine-700">
                    {product.categoryName}
                  </Link>
                </li>
              </>
            )}
            <li aria-hidden>/</li>
            <li className="text-ink-800">{product.title}</li>
          </ol>
        </nav>

        <div className="grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          <ProductGallery images={product.images} title={product.title} />

          <div className="lg:pt-6">
            {product.categoryName && <Eyebrow>{product.categoryName}</Eyebrow>}
            <h1 className="font-display mt-4 text-4xl leading-tight text-balance md:text-5xl">
              {product.title}
            </h1>

            <div className="mt-5 flex items-baseline gap-3">
              <span className="font-display text-3xl tabular-nums">{formatPrice(product.priceCents)}</span>
              {onSale && (
                <span className="text-base tabular-nums text-ink-600 line-through">
                  {formatPrice(product.compareAtCents!)}
                </span>
              )}
            </div>

            <p className="mt-6 text-sm leading-[1.85] text-ink-600 text-pretty">
              {product.description}
            </p>

            <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-cream-300 py-6 text-sm">
              {product.colorName && (
                <div>
                  <dt className="eyebrow text-ink-600">Colour</dt>
                  <dd className="mt-1.5 flex items-center gap-2">
                    {product.colorHex && (
                      <span
                        aria-hidden
                        className="h-3.5 w-3.5 rounded-full border border-ink-900/12"
                        style={{ backgroundColor: product.colorHex }}
                      />
                    )}
                    {product.colorName}
                  </dd>
                </div>
              )}
              {product.widthCm && (
                <div>
                  <dt className="eyebrow text-ink-600">Blade width</dt>
                  <dd className="mt-1.5">{product.widthCm} cm</dd>
                </div>
              )}
              <div>
                <dt className="eyebrow text-ink-600">Availability</dt>
                <dd className="mt-1.5">
                  {product.stock <= 0 ? "Sold out" : product.stock <= 5 ? `Only ${product.stock} left` : "In stock"}
                </dd>
              </div>
              <div>
                <dt className="eyebrow text-ink-600">Care</dt>
                <dd className="mt-1.5">{CARE_BY_CATEGORY[product.categorySlug] ?? DEFAULT_CARE}</dd>
              </div>
            </dl>

            <div className="mt-8">
              <AddToBag product={product} />
            </div>

            <ul className="mt-8 space-y-3">
              {promises(settings.freeThresholdCents).map(({ Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-sm text-ink-600">
                  <Icon className="h-4 w-4 shrink-0 text-wine-700" strokeWidth={1.5} aria-hidden />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mx-auto max-w-[1400px] px-5 pb-20 md:px-10 md:pb-28">
          <SectionHeading
            eyebrow="Goes well with"
            title="More from this collection"
            action={{ href: `/collections/${product.categorySlug}`, label: "View all" }}
          />
          <div className="mt-12">
            <ProductGrid products={related} priorityCount={0} />
          </div>
        </section>
      )}
    </>
  );
}
