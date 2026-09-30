import { Eyebrow } from "@/components/ui/eyebrow";

/** Tinted cream band that opens every interior page. */
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
    <section className="-mt-20 border-b border-cream-300 bg-cream-100 pt-20">
      <div className="mx-auto max-w-[1400px] px-5 py-14 md:px-10 md:py-20">
        {eyebrow && <Eyebrow rule>{eyebrow}</Eyebrow>}
        <h1 className="font-display mt-5 text-[clamp(2.5rem,6vw,4.25rem)] leading-[1] text-ink-900 text-balance">
          {title}
        </h1>
        {lede && (
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-ink-600 text-pretty md:text-base">
            {lede}
          </p>
        )}
      </div>
    </section>
  );
}
