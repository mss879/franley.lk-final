import type { Metadata } from "next";
import { HeroSlider } from "@/components/site/hero-slider";
import { CategoryShowcase } from "@/components/site/category-showcase";
import { EditorialBand } from "@/components/site/editorial-band";
import { ValueProps } from "@/components/site/value-props";
import { Marquee } from "@/components/ui/marquee";
import { SectionHeading } from "@/components/ui/section-heading";
import { ArrivalsRail } from "@/components/shop/arrivals-rail";
import { ProductCard } from "@/components/shop/product-card";
import { getProducts } from "@/lib/data";
import { getHomeContent } from "@/lib/cms";
import { buildMetadata } from "@/lib/seo";
import type { Product, ProductQuery } from "@/types/domain";

export const revalidate = 60;

export const metadata: Metadata = buildMetadata({
  description:
    "Neckties and cufflink sets for the modern gentleman. Silk-finish ties at Rs 1,190, gift-boxed cufflink sets at Rs 1,790, delivered island-wide in Sri Lanka.",
  canonical: "/",
});

const SECTION_SIZE = 8;

/**
 * A home product section shows its collection's products in the collection's
 * own order (0020_home_sections.sql). Only when that collection is missing,
 * hidden or empty does it fall back to the automatic list it showed before —
 * and the "View all" link follows whichever list is on screen.
 */
async function sectionProducts(
  collectionSlug: string,
  fallback: { query: ProductQuery; href: string } | null,
): Promise<{ products: Product[]; href: string | null }> {
  if (collectionSlug) {
    const picked = await getProducts({ collectionSlug, limit: SECTION_SIZE });
    if (picked.products.length > 0) {
      return { products: picked.products, href: `/collections/${collectionSlug}` };
    }
  }
  if (!fallback) return { products: [], href: null };
  const auto = await getProducts({ ...fallback.query, limit: SECTION_SIZE });
  return { products: auto.products, href: fallback.href };
}

function toRailItems(products: Product[]) {
  return products.map((p) => ({
    href: `/products/${p.slug}`,
    src: p.images[0] ?? "/brand/og-hero.jpg",
    alt: p.title,
    title: p.title,
    priceCents: p.priceCents,
    categoryName: p.categoryName,
  }));
}

export default async function HomePage() {
  const content = await getHomeContent();
  const showTrending = !content.hiddenSections.includes("trending");

  const [featured, latest, trending] = await Promise.all([
    sectionProducts(content.collection.collection, {
      query: { featured: true },
      href: "/shop",
    }),
    sectionProducts(content.lookbook.collection, {
      query: { sort: "newest" },
      href: "/shop?sort=newest",
    }),
    showTrending
      ? sectionProducts(content.trending.collection, null)
      : Promise.resolve({ products: [] as Product[], href: null }),
  ]);

  return (
    <>
      <HeroSlider slides={content.heroSlides} />

      <CategoryShowcase content={content.showcase} />

      <Marquee items={content.marquee} tone="light" />

      {/* ---- The collection ---- */}
      <section id="collection" className="mx-auto max-w-[1400px] px-5 py-20 md:px-10 md:py-28">
        <SectionHeading
          eyebrow={content.collection.eyebrow}
          title={content.collection.title}
          lede={content.collection.lede}
          action={{ href: featured.href ?? "/shop", label: "View all" }}
        />
        <div className="mt-14 grid grid-cols-2 gap-x-5 gap-y-12 lg:grid-cols-4">
          {featured.products.map((p) => (
            <ProductCard
              key={p.id}
              product={{
                slug: p.slug,
                title: p.title,
                priceCents: p.priceCents,
                compareAtCents: p.compareAtCents,
                image: p.images[0] ?? null,
                hoverImage: p.images[1] ?? null,
                colorName: p.colorName,
                colorHex: p.colorHex,
                categoryName: p.categoryName,
                soldOut: p.stock <= 0,
              }}
            />
          ))}
        </div>
      </section>

      <EditorialBand content={content.editorial} />

      {/* ---- New arrivals: white cards on a tinted band. The editorial band
          above is the page's one dark passage; a second would crowd it. ---- */}
      <section className="border-t border-cream-300 bg-cream-100 py-20 md:py-28">
        <div className="mx-auto max-w-[1400px] px-5 md:px-10">
          <SectionHeading
            eyebrow={content.lookbook.eyebrow}
            title={content.lookbook.title}
            lede={content.lookbook.lede}
            action={{ href: latest.href ?? "/shop?sort=newest", label: "View all" }}
          />
          <div className="mt-14">
            <ArrivalsRail items={toRailItems(latest.products)} />
          </div>
        </div>
      </section>

      {/* ---- Trending: the same rail on the plain page colour, so it reads as
          its own band rather than a continuation of New in. Left out when
          its block is unpublished or its collection has nothing live. ---- */}
      {trending.products.length > 0 && (
        <section className="border-t border-cream-300 py-20 md:py-28">
          <div className="mx-auto max-w-[1400px] px-5 md:px-10">
            <SectionHeading
              eyebrow={content.trending.eyebrow}
              title={content.trending.title}
              lede={content.trending.lede}
              action={trending.href ? { href: trending.href, label: "View all" } : undefined}
            />
            <div className="mt-14">
              <ArrivalsRail items={toRailItems(trending.products)} />
            </div>
          </div>
        </section>
      )}

      <ValueProps />
    </>
  );
}
