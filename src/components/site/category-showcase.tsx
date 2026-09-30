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
 * unrelated sites. Cream here also gives the ink marquee below something to
 * push against.
 */
export function CategoryShowcase({ content }: { content: ShowcaseContent }) {
  if (!content.cards?.length) return null;

  return (
    <section className="mx-auto max-w-[1400px] px-5 py-16 md:px-10 md:py-24">
      <SectionHeading
        eyebrow={content.eyebrow}
        title={content.title}
        lede={content.lede}
        action={{ href: "/shop", label: "View all" }}
      />

      <div className="mt-10 grid gap-5 md:mt-12 md:grid-cols-2 md:gap-6">
        {content.cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group relative flex aspect-[4/3] flex-col justify-end overflow-hidden rounded-3xl bg-ink-900 p-6 text-cream-50 transition-shadow duration-500 ease-[--ease-lux] hover:shadow-[0_28px_60px_-32px_rgba(23,21,20,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-4 focus-visible:ring-offset-cream-50 md:aspect-[16/10] md:p-8"
          >
            <Image
              src={card.image}
              alt={card.imageAlt}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1480px) 50vw, 660px"
              className="object-cover transition-transform duration-[900ms] ease-[--ease-lux] group-hover:scale-[1.05]"
            />
            {/* A neutral wash, so the photograph keeps its own colour. */}
            <span
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-ink-950/85 via-ink-950/20 to-transparent"
            />

            <div className="relative flex items-end justify-between gap-5">
              <div>
                <span className="eyebrow text-champagne-300">{card.kicker}</span>
                <h3 className="font-display mt-2 text-2xl leading-tight md:text-3xl">
                  {card.name}
                </h3>
                <span
                  aria-hidden
                  className="mt-4 block h-px w-10 bg-champagne-400/70 transition-all duration-500 ease-[--ease-lux] group-hover:w-24"
                />
              </div>

              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-cream-100/40 transition-colors duration-300 group-hover:border-cream-100 group-hover:bg-cream-100 group-hover:text-ink-900">
                <ArrowUpRight className="h-4 w-4" strokeWidth={1.5} aria-hidden />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
