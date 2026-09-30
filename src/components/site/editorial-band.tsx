import Image from "next/image";
import { VideoFrame } from "@/components/ui/video-frame";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";

export type EditorialContent = {
  /** When present the large frame plays this clip instead of imageLarge. */
  videoLarge?: string | null;
  videoLargePoster?: string | null;
  eyebrow: string;
  title: string;
  subtitle: string;
  body: string;
  cta: { href: string; label: string };
  imageLarge: string;
  imageLargeAlt: string;
  imageSmall: string;
  imageSmallAlt: string;
};

/**
 * Board 2's editorial band: champagne serif display on a dark ink
 * vignette, wide-tracked small-caps subtitle, and an offset image pair where
 * the smaller frame overlaps the larger one's corner.
 */
export function EditorialBand({ content }: { content: EditorialContent }) {
  return (
    <section className="silk-texture focus-on-dark relative overflow-hidden bg-ink-900 py-20 text-cream-100 md:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(203,174,115,0.10)_0%,transparent_70%)]"
      />

      <div className="relative mx-auto max-w-[1400px] px-5 md:px-10">
        <div className="text-center">
          <Eyebrow tone="light">{content.eyebrow}</Eyebrow>
          <h2 className="font-display mt-5 text-[clamp(2.5rem,7vw,5rem)] leading-[0.95] text-champagne-300 text-balance">
            {content.title}
          </h2>
          <p
            className="mt-4 text-[0.7rem] font-medium uppercase text-cream-100/60 md:text-xs"
            style={{ letterSpacing: "0.42em" }}
          >
            {content.subtitle}
          </p>
        </div>

        <div className="mt-16 grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Offset pair */}
          <div className="relative pb-16 pr-16 sm:pb-20 sm:pr-24">
            {content.videoLarge && content.videoLargePoster ? (
              <VideoFrame
                src={content.videoLarge}
                poster={content.videoLargePoster}
                alt={content.imageLargeAlt}
                className="aspect-[4/3] w-full rounded-2xl"
              />
            ) : (
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-ink-950">
                <Image
                  src={content.imageLarge}
                  alt={content.imageLargeAlt}
                  fill
                  sizes="(max-width: 1024px) 100vw, 620px"
                  className="object-cover"
                />
              </div>
            )}
            <div className="absolute bottom-0 right-0 aspect-[4/3] w-[52%] overflow-hidden rounded-2xl border-4 border-ink-900 bg-ink-950">
              <Image
                src={content.imageSmall}
                alt={content.imageSmallAlt}
                fill
                sizes="(max-width: 1024px) 50vw, 320px"
                className="object-cover"
              />
            </div>
          </div>

          <div className="max-w-lg">
            <span aria-hidden className="block h-px w-16 bg-champagne-400/50" />
            <p className="mt-7 text-sm leading-[1.9] text-cream-100/75 text-pretty md:text-base">
              {content.body}
            </p>
            <ButtonLink href={content.cta.href} variant="outlineLight" size="lg" className="mt-9">
              {content.cta.label}
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
