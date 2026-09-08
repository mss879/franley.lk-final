import type { Metadata } from "next";
import Image from "next/image";
import { PageHeader } from "@/components/site/page-header";
import { Prose } from "@/components/site/prose";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Fabric Care",
  description: "How to store, clean and rescue a silk-finish necktie so it lasts years rather than seasons.",
  canonical: "/care",
  ogType: "article",
});

export default function CarePage() {
  return (
    <>
      <PageHeader
        eyebrow="Guides"
        title="Fabric Care"
        lede="A good tie will outlast the suit it was bought for, if you treat it like cloth rather than a strap."
      />
      <div className="mx-auto max-w-[1400px] px-5 py-14 md:px-10 md:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-20">
          <Prose>
            <h2>Untie it properly</h2>
            <p>
              Never pull the narrow end back through the knot. Reverse the steps
              you tied it with. Yanking a knot loose stretches the bias and puts
              a permanent twist in the blade — it is the single fastest way to
              ruin a tie.
            </p>

            <h2>Let it rest</h2>
            <p>
              Hang the tie or roll it loosely after wearing and give it a day
              off. The interlining needs time to recover its shape. A tie worn
              two days running keeps the creases of the first day.
            </p>

            <h2>Storing</h2>
            <ul>
              <li>Roll from the narrow end and store flat in a drawer, or hang from a smooth rail.</li>
              <li>Keep it out of direct sunlight — silk-finish colours fade before the cloth wears out.</li>
              <li>Do not fold along the blade. A fold becomes a crease, and a crease becomes a line.</li>
            </ul>

            <h2>Creases</h2>
            <p>
              Most creases drop out overnight from hanging. For a stubborn one,
              hang the tie in a steamy bathroom for ten minutes. If you must
              iron, use the lowest setting, a pressing cloth between the iron and
              the silk, and never press the edges flat — the rolled edge is what
              gives a tie its life.
            </p>

            <h2>Spills</h2>
            <ul>
              <li>Blot immediately with a dry cloth. Never rub, and never use water on silk.</li>
              <li>Do not machine wash or hand wash. Water rings on silk are permanent.</li>
              <li>Take it to a dry cleaner and tell them what the stain is.</li>
            </ul>

            <h2>The short version</h2>
            <p>
              <strong>Dry clean only.</strong> Untie it the way you tied it, rest
              it a day, roll it in a drawer, and it will still look right in five
              years.
            </p>
          </Prose>

          <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-ink-900 lg:sticky lg:top-28 lg:h-fit">
            <Image
              src="/editorial/cat-neckties.webp"
              alt="A burgundy silk necktie rolled on a dark wooden surface"
              fill
              sizes="(max-width: 1024px) 100vw, 520px"
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </>
  );
}
