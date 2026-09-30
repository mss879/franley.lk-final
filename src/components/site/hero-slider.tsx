"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/utils";

export type HeroSlide = {
  image: string;
  imageAlt: string;
  eyebrow: string;
  title: string;
  lede: string;
  cta: { href: string; label: string };
};

const INTERVAL = 7000;

/**
 * The box the photograph is drawn in. It fills the banner, except on a window
 * wider than the 3:2 photograph, where it becomes a centred 3:2 box the height
 * of the banner with feathered sides.
 */
const FRAME =
  "absolute inset-0 " +
  "[@media(min-aspect-ratio:3/2)]:left-1/2 [@media(min-aspect-ratio:3/2)]:right-auto " +
  "[@media(min-aspect-ratio:3/2)]:aspect-[3/2] [@media(min-aspect-ratio:3/2)]:-translate-x-1/2 " +
  "[@media(min-aspect-ratio:3/2)]:[mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]";

/**
 * The banner that opens the home page: one photograph filling the first
 * screen, with the copy at the foot, over the dark tabletop, rather than across
 * the product.
 *
 * The supplied banner is 3:2 and a browser window is usually wider than that.
 * Filling the width would crop a quarter of the picture away, so on a window
 * wider than 3:2 the photograph is shown whole at full height instead, and its
 * left and right edges fade into the ink behind it.
 *
 * One published banner renders as a still image. A second one turns the same
 * frame into a slider.
 *
 * Advances on its own, but stops the moment anyone interacts — hover, focus,
 * or a control — and never advances at all for `prefers-reduced-motion`.
 */
export function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const region = useRef<HTMLElement>(null);

  const go = useCallback(
    (next: number) => setIndex(((next % slides.length) + slides.length) % slides.length),
    [slides.length],
  );

  useEffect(() => {
    if (paused || slides.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const id = window.setInterval(() => setIndex((n) => (n + 1) % slides.length), INTERVAL);
    return () => window.clearInterval(id);
  }, [paused, slides.length]);

  if (!slides.length) return null;
  const active = slides[index];

  return (
    <section
      ref={region}
      aria-roledescription="carousel"
      aria-label="Featured collections"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(index + 1);
        if (e.key === "ArrowLeft") go(index - 1);
      }}
      className="focus-on-dark relative -mt-20 h-dvh min-h-[560px] overflow-hidden bg-ink-950 pt-20 text-cream-100"
    >
      {slides.map((slide, i) => (
        <div
          key={slide.image}
          aria-hidden={i !== index}
          className={cn(
            "absolute inset-0 transition-opacity duration-[900ms] ease-[--ease-lux]",
            i === index ? "opacity-100" : "opacity-0",
          )}
        >
          <div className={FRAME}>
            <Image
              src={slide.image}
              alt={i === index ? slide.imageAlt : ""}
              fill
              preload={i === 0}
              sizes="100vw"
              // Narrow screens crop to a vertical slice; the subject sits right
              // of centre, so the slice is taken from there.
              className="object-cover object-[62%_center] md:object-center"
            />
          </div>
          {/* Neutral washes only — a tinted one would recolour the product.
              The foot darkens to carry the copy; the corner wash keeps the
              headline legible where it runs past the tabletop. */}
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/70 via-45% to-ink-950/10 md:from-ink-950/95 md:via-ink-950/35 md:via-40% md:to-transparent"
          />
          <span
            aria-hidden
            className="absolute inset-0 hidden bg-[radial-gradient(60%_70%_at_0%_100%,rgba(14,13,12,0.8)_0%,transparent_70%)] md:block"
          />
          {/* Holds the floating header. */}
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-ink-950/90 via-ink-950/50 to-transparent"
          />
        </div>
      ))}

      <div
        className={cn(
          "relative mx-auto flex h-full max-w-[1400px] flex-col justify-end px-5 md:px-10",
          // Room for the slide controls when there is more than one banner.
          slides.length > 1 ? "pb-24" : "pb-12 md:pb-16",
        )}
      >
        <div key={index} className="max-w-xl animate-fade-up">
          <Eyebrow tone="light" rule>{active.eyebrow}</Eyebrow>
          <h1 className="font-display mt-5 text-[clamp(2.25rem,4.4vw,3.75rem)] leading-[1.02] text-balance">
            {active.title}
          </h1>
          <span aria-hidden className="mt-6 block h-px w-14 bg-champagne-400/60" />
          <p className="mt-6 max-w-md text-sm leading-relaxed text-cream-100/75 text-pretty md:text-base">
            {active.lede}
          </p>
          <ButtonLink href={active.cta.href} variant="cream" size="lg" className="mt-8">
            {active.cta.label}
          </ButtonLink>
        </div>
      </div>

      {slides.length > 1 && (
        <div className="absolute inset-x-0 bottom-0 z-10">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-6 px-5 pb-7 md:px-10">
            {/* Dots double as a progress readout */}
            <div className="flex items-center gap-3" role="tablist" aria-label="Choose a slide">
              {slides.map((slide, i) => (
                <button
                  key={slide.image}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Slide ${i + 1}: ${slide.title}`}
                  onClick={() => setIndex(i)}
                  className={cn(
                    "h-1 rounded-full transition-all duration-500 ease-[--ease-lux]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-4 focus-visible:ring-offset-ink-950",
                    i === index ? "w-12 bg-champagne-400" : "w-6 bg-cream-100/35 hover:bg-cream-100/60",
                  )}
                />
              ))}
              <span className="ml-2 text-xs tabular-nums text-cream-100/50">
                {String(index + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
              </span>
            </div>

            <div className="flex gap-2">
              {([["Previous slide", -1, ArrowLeft], ["Next slide", 1, ArrowRight]] as const).map(
                ([label, dir, Icon]) => (
                  <button
                    key={label}
                    type="button"
                    aria-label={label}
                    onClick={() => go(index + dir)}
                    className="grid h-11 w-11 place-items-center rounded-full border border-cream-100/30 transition-colors duration-300 hover:border-cream-100 hover:bg-cream-100/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950"
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                  </button>
                ),
              )}
            </div>
          </div>
        </div>
      )}

      <span className="sr-only" aria-live="polite">
        Slide {index + 1} of {slides.length}: {active.title}
      </span>
    </section>
  );
}
