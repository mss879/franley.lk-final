import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/site/page-header";
import { SectionHeading } from "@/components/ui/section-heading";
import { getCategories, getCollections } from "@/lib/data";
import { JsonLd, breadcrumbJsonLd, buildMetadata } from "@/lib/seo";
import type { Collection } from "@/types/domain";
import { CollectionImage } from "./collection-image";

export const revalidate = 60;

const DESCRIPTION =
  "Hand-picked edits from across the Franley range — for gifting, for the office, for the day itself. Neckties and cufflink sets, delivered island-wide in Sri Lanka.";

export const metadata: Metadata = buildMetadata({
  title: "Collections",
  description: DESCRIPTION,
  canonical: "/collections",
});

/**
 * Same card as the homepage showcase: editorial image, burgundy gradient,
 * name and kicker in the corner. Without an image it is a plain wine panel,
 * which reads as part of the house rather than as a missing picture.
 */
function CollectionCard({ collection, priority }: { collection: Collection; priority: boolean }) {
  const count = collection.productCount ?? 0;
  return (
    <Link
      href={`/collections/${collection.slug}`}
      className="group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-3xl bg-wine-800 p-7 text-cream-50 transition-shadow duration-500 ease-[--ease-lux] hover:shadow-[0_28px_60px_-32px_rgba(64,11,22,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-4 focus-visible:ring-offset-cream-50 md:aspect-[4/4.4] md:p-9"
    >
      {collection.imageUrl ? (
        <>
          <CollectionImage
            url={collection.imageUrl}
            alt=""
            priority={priority}
            sizes="(max-width: 768px) 100vw, (max-width: 1480px) 50vw, 660px"
            className="object-cover transition-transform duration-[900ms] ease-[--ease-lux] group-hover:scale-[1.05]"
          />
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-wine-950/92 via-wine-950/35 to-transparent"
          />
        </>
      ) : (
        <span aria-hidden className="silk-texture absolute inset-0" />
      )}

      <div className="relative flex items-end justify-between gap-5">
        <div className="min-w-0">
          <span className="eyebrow text-champagne-300">{collection.heroEyebrow ?? "Collection"}</span>
          <h2 className="font-display mt-2 text-3xl leading-tight md:text-4xl">{collection.name}</h2>
          {collection.description && (
            <p className="mt-3 line-clamp-2 max-w-md text-sm leading-relaxed text-cream-100/70">
              {collection.description}
            </p>
          )}
          {/* Never zero: getCollections() leaves empty collections out. */}
          <p className="mt-4 text-xs text-cream-100/60">
            {count} {count === 1 ? "piece" : "pieces"}
          </p>
        </div>

        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-cream-100/40 transition-colors duration-300 group-hover:border-cream-100 group-hover:bg-cream-100 group-hover:text-wine-800">
          <ArrowUpRight className="h-4 w-4" strokeWidth={1.5} aria-hidden />
        </span>
      </div>
    </Link>
  );
}

export default async function CollectionsIndexPage() {
  const [collections, categories] = await Promise.all([getCollections(), getCategories()]);

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Collections", path: "/collections" },
        ])}
      />

      <PageHeader
        eyebrow="Curated"
        title="Collections"
        lede="Edits picked by hand from across the range — a starting point when you know the occasion but not yet the tie."
      />

      <section className="mx-auto max-w-[1400px] px-5 py-12 md:px-10 md:py-16">
        {collections.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-cream-300 py-24 text-center">
            <p className="font-display text-2xl">Nothing curated yet</p>
            <p className="mt-2 text-sm text-ink-600">
              The first edits are being put together. Browse by category below, or see the full range.
            </p>
          </div>
        ) : (
          <ul className="grid gap-5 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
            {collections.map((collection, i) => (
              <li key={collection.id}>
                <CollectionCard collection={collection} priority={i < 2} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mx-auto max-w-[1400px] px-5 pb-20 md:px-10 md:pb-28">
        <SectionHeading
          eyebrow="Or by type"
          title="Browse by category"
          action={{ href: "/shop", label: "Shop all" }}
        />
        <nav aria-label="Categories" className="mt-8 flex flex-wrap gap-2">
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/collections/${category.slug}`}
              className="rounded-full border border-cream-300 px-5 py-2.5 text-sm text-ink-800 transition-colors duration-300 hover:border-wine-700 hover:text-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
            >
              {category.name}
              {typeof category.productCount === "number" && category.productCount > 0 && (
                <span className="ml-2 text-xs text-ink-600">{category.productCount}</span>
              )}
            </Link>
          ))}
        </nav>
      </section>
    </>
  );
}
