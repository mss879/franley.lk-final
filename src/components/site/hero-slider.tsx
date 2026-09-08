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
 * The banner slider that opens the home page. Three quarters of the viewport
 * tall, so the section beneath is always visible and the page reads as a shop
 * rather than a poster.
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
      className="relative -mt-20 h-[75dvh] min-h-[520px] overflow-hidden bg-wine-950 pt-20 text-cream-100"
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
          <Image
            src={slide.image}
            alt={i === index ? slide.imageAlt : ""}
            fill
            priority={i === 0}
            sizes="100vw"
            className={cn(
              "object-cover transition-transform duration-[8000ms] ease-linear",
              i === index ? "scale-105" : "scale-100",
            )}
          />
          {/* Just enough wash to hold the headline on the left. The banners are
              shot with the left side already in shadow, so the right stays open
              and the photography actually reads. */}
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-r from-wine-950/85 via-wine-950/30 to-transparent"
          />
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-wine-950/70 via-transparent to-transparent"
          />
        </div>
      ))}

      <div className="relative mx-auto flex h-full max-w-[1400px] flex-col justify-center px-5 pb-20 md:px-10">
        <div key={index} className="max-w-xl animate-fade-up">
          {/* The wordmark rides on the banner itself rather than being baked
              into the photograph, so it stays crisp at every viewport and the
              same two images can carry different campaigns. */}
          <Image
            src="/brand/logo-dark.png"
            alt="Franley"
            width={200}
            height={40}
            loading="eager"
            className="h-6 w-auto brightness-0 invert md:h-7"
          />
          <div className="mt-5">
            <Eyebrow tone="light" rule>{active.eyebrow}</Eyebrow>
          </div>
          <h1 className="font-display mt-4 text-[clamp(2.2rem,4.8vw,4.25rem)] leading-[0.96] text-balance">
            {active.title}
          </h1>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-cream-100/75 text-pretty md:text-base">
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
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-4 focus-on-wine focus-visible:ring-offset-wine-950",
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
                    className="grid h-11 w-11 place-items-center rounded-full border border-cream-100/30 transition-colors duration-300 hover:border-cream-100 hover:bg-cream-100/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-on-wine focus-visible:ring-offset-wine-950"
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
