import { ButtonLink } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";

export default function NotFound() {
  return (
    <section className="silk-texture -mt-20 grid min-h-dvh place-items-center bg-wine-700 px-5 pt-20 text-center text-cream-100">
      <div className="max-w-lg">
        <Eyebrow tone="light">Error 404</Eyebrow>
        <h1 className="font-display mt-5 text-[clamp(2.5rem,7vw,4.5rem)] leading-[0.98] text-balance">
          This one got away
        </h1>
        <p className="mt-5 text-sm leading-relaxed text-cream-100/70 text-pretty md:text-base">
          The page you were after has moved or never existed. The collection is
          still where you left it.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/shop" variant="cream" size="lg">Browse the collection</ButtonLink>
          <ButtonLink href="/contact" variant="outlineLight" size="lg">Contact us</ButtonLink>
        </div>
      </div>
    </section>
  );
}
