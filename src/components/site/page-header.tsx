import { Eyebrow } from "@/components/ui/eyebrow";

/** Burgundy band that opens every interior page. */
export function PageHeader({
  eyebrow,
  title,
  lede,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
}) {
  return (
    <section className="silk-texture -mt-20 bg-wine-700 pt-20 text-cream-100">
      <div className="mx-auto max-w-[1400px] px-5 py-16 md:px-10 md:py-24">
        {eyebrow && <Eyebrow tone="light" rule>{eyebrow}</Eyebrow>}
        <h1 className="font-display mt-5 text-[clamp(2.5rem,6.5vw,4.5rem)] leading-[0.98] text-balance">
          {title}
        </h1>
        {lede && (
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-cream-100/70 text-pretty md:text-base">
            {lede}
          </p>
        )}
      </div>
    </section>
  );
}
