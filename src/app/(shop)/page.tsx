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

export const revalidate = 60;

export const metadata: Metadata = buildMetadata({
  description:
    "Neckties and cufflink sets for the modern gentleman. Silk-finish ties at Rs 1,190, gift-boxed cufflink sets at Rs 1,790, delivered island-wide in Sri Lanka.",
  canonical: "/",
});

export default async function HomePage() {
  const [content, featured, latest] = await Promise.all([
    getHomeContent(),
    getProducts({ featured: true, limit: 8 }),
    getProducts({ sort: "newest", limit: 8 }),
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
          action={{ href: "/shop", label: "View all" }}
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

      {/* ---- New arrivals: cream cards on burgundy, echoing the hero ---- */}
      <section className="silk-texture bg-wine-800 py-20 text-cream-100 md:py-28">
        <div className="mx-auto max-w-[1400px] px-5 md:px-10">
          <SectionHeading
            tone="light"
            eyebrow={content.lookbook.eyebrow}
            title={content.lookbook.title}
            lede={content.lookbook.lede}
            action={{ href: "/shop?sort=newest", label: "View all" }}
          />
          <div className="mt-14">
            <ArrivalsRail
              items={latest.products.map((p) => ({
                href: `/products/${p.slug}`,
                src: p.images[0] ?? "/brand/og-hero.jpg",
                alt: p.title,
                title: p.title,
                priceCents: p.priceCents,
                categoryName: p.categoryName,
              }))}
            />
          </div>
        </div>
      </section>

      <ValueProps />
    </>
  );
}
