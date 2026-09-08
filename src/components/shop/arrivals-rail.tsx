"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { formatPrice, cn } from "@/lib/utils";

export type ArrivalItem = {
  href: string;
  src: string;
  alt: string;
  title: string;
  priceCents: number;
  categoryName?: string | null;
};

/**
 * New arrivals as cream cards floating on burgundy — the same card-on-wine
 * motif as the hero, so it reads as one house rather than a borrowed layout.
 * Cards sit on a scroll-snap rail with real prev/next controls.
 */
export function ArrivalsRail({ items }: { items: ArrivalItem[] }) {
  const rail = useRef<HTMLDivElement>(null);

  const nudge = (dir: 1 | -1) => {
    const el = rail.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-card]");
    const step = card ? card.offsetWidth + 20 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div
        ref={rail}
        className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-2 md:mx-0 md:px-0"
      >
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            data-card
            className={cn(
              "group w-[70vw] shrink-0 snap-start rounded-3xl bg-cream-100 p-3 text-ink-900",
              "transition-shadow duration-500 ease-[--ease-lux] hover:shadow-[0_28px_60px_-30px_rgba(0,0,0,0.55)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-4 focus-on-wine focus-visible:ring-offset-wine-800",
              "sm:w-[44vw] lg:w-[272px]",
            )}
          >
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-white">
              <Image
                src={item.src}
                alt={item.alt}
                fill
                sizes="(max-width: 640px) 70vw, (max-width: 1024px) 44vw, 272px"
                className="object-contain p-5 transition-transform duration-700 ease-[--ease-lux] group-hover:scale-[1.05]"
              />
              {item.categoryName && (
                <span className="absolute left-3 top-3 rounded-full bg-wine-700 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-cream-50">
                  {item.categoryName}
                </span>
              )}
            </div>

            <div className="px-2 pb-2 pt-4">
              <h3 className="font-display line-clamp-2 min-h-[2.6em] text-base leading-snug transition-colors duration-300 group-hover:text-wine-700">
                {item.title}
              </h3>
              <span className="mt-1.5 block text-sm tabular-nums text-ink-600">
                {formatPrice(item.priceCents)}
              </span>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8 flex items-center gap-3">
        {([["Previous arrivals", -1, ArrowLeft], ["Next arrivals", 1, ArrowRight]] as const).map(
          ([label, dir, Icon]) => (
            <button
              key={label}
              type="button"
              onClick={() => nudge(dir)}
              aria-label={label}
              className="grid h-12 w-12 place-items-center rounded-full border border-cream-100/30 text-cream-100 transition-colors duration-300 hover:border-cream-100 hover:bg-cream-100/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-on-wine focus-visible:ring-offset-wine-800"
            >
              <Icon className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            </button>
          ),
        )}
      </div>
    </div>
  );
}
