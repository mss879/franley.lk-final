import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SectionHeading } from "@/components/ui/section-heading";

export type ShowcaseCard = {
  href: string;
  image: string;
  imageAlt: string;
  /** Small label above the name, e.g. "Curated elegance". */
  kicker: string;
  name: string;
  /** Kept for CMS compatibility; the palette no longer varies per card. */
  accent?: "wine" | "champagne";
};

export type ShowcaseContent = {
  eyebrow: string;
  title: string;
  lede: string;
  cards: ShowcaseCard[];
};

/**
 * The two headline collections, directly beneath the banner.
 *
 * Deliberately on the cream page rather than a dark panel: the banner above is
 * already dark, and stacking a second dark slab under it reads as two
 * unrelated sites. Cream here also gives the burgundy marquee below something
 * to push against.
 */
export function CategoryShowcase({ content }: { content: ShowcaseContent }) {
  if (!content.cards?.length) return null;

  return (
    <section className="mx-auto max-w-[1400px] px-5 py-20 md:px-10 md:py-28">
      <SectionHeading
        eyebrow={content.eyebrow}
        title={content.title}
        lede={content.lede}
        action={{ href: "/shop", label: "View all" }}
      />

      <div className="mt-14 grid gap-5 md:grid-cols-2 md:gap-6">
        {content.cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-3xl bg-ink-900 p-7 text-cream-50 transition-shadow duration-500 ease-[--ease-lux] hover:shadow-[0_28px_60px_-32px_rgba(64,11,22,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-4 focus-visible:ring-offset-cream-50 md:aspect-[4/4.4] md:p-9"
          >
            <Image
              src={card.image}
              alt={card.imageAlt}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1480px) 50vw, 660px"
              className="object-cover transition-transform duration-[900ms] ease-[--ease-lux] group-hover:scale-[1.05]"
            />
            {/* Burgundy rather than black, so the cards read as part of the house. */}
            <span
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-wine-950/92 via-wine-950/35 to-transparent"
            />

            <div className="relative flex items-end justify-between gap-5">
              <div>
                <span className="eyebrow text-champagne-300">{card.kicker}</span>
                <h3 className="font-display mt-2 text-3xl leading-tight md:text-4xl">
                  {card.name}
                </h3>
                <span
                  aria-hidden
                  className="mt-4 block h-px w-10 bg-champagne-400/70 transition-all duration-500 ease-[--ease-lux] group-hover:w-24"
                />
              </div>

              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-cream-100/40 transition-colors duration-300 group-hover:border-cream-100 group-hover:bg-cream-100 group-hover:text-wine-800">
                <ArrowUpRight className="h-4 w-4" strokeWidth={1.5} aria-hidden />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
