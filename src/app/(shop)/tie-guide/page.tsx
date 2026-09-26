import type { Metadata } from "next";
import Image from "next/image";
import { PageHeader } from "@/components/site/page-header";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ButtonLink } from "@/components/ui/button";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "How to Tie a Knot",
  description: "Three necktie knots worth knowing — the four-in-hand, the half Windsor and the full Windsor — and when to use each.",
  canonical: "/tie-guide",
  ogType: "article",
});

const KNOTS = [
  {
    name: "Four-in-hand",
    difficulty: "Easiest",
    shape: "Narrow, slightly asymmetric",
    collar: "Point and button-down collars",
    body:
      "The everyday knot. It sits a little off-centre by design, which is the point — it looks worn rather than arranged. Best on a narrower blade and with a shirt whose collar points sit close together.",
    steps: [
      "Wide end on your right, hanging about 30cm below the narrow end.",
      "Cross the wide end over the narrow end, then wrap it fully behind.",
      "Bring the wide end across the front again, left to right.",
      "Pass it up through the neck loop from underneath.",
      "Feed it down through the front loop you just made, and draw it tight while holding the narrow end.",
    ],
  },
  {
    name: "Half Windsor",
    difficulty: "Moderate",
    shape: "Symmetrical, medium triangle",
    collar: "Most collars — the safe default",
    body:
      "The knot to use when you are not sure. Balanced enough for a meeting, not so wide that it swamps a standard collar. If you only learn one knot after the four-in-hand, learn this.",
    steps: [
      "Wide end on your right, roughly 30cm lower than the narrow end.",
      "Cross wide over narrow, then bring the wide end up through the neck loop.",
      "Pull it down and around behind the narrow end, right to left.",
      "Bring the wide end back up through the neck loop again.",
      "Feed it down through the front loop and tighten, sliding the knot up to the collar.",
    ],
  },
  {
    name: "Full Windsor",
    difficulty: "Hardest",
    shape: "Wide, fully symmetrical triangle",
    collar: "Spread and cutaway collars",
    body:
      "Formal, deliberate, and hungry for length — start with the wide end lower than you think. Worth it for weddings and anything photographed. On a narrow collar it will look crowded.",
    steps: [
      "Wide end on your right, hanging well below the narrow end.",
      "Cross wide over narrow and pass it up through the neck loop.",
      "Bring it down on the left, then behind and up through the neck loop again on the right.",
      "Pull it across the front, right to left.",
      "Bring it up through the neck loop once more, feed it down through the front loop, and tighten evenly.",
    ],
  },
];

export default function TieGuidePage() {
  return (
    <>
      <PageHeader
        eyebrow="Guides"
        title="How to Tie a Knot"
        lede="Three knots cover every occasion you will realistically dress for. Here is when to use each, and how."
      />

      <div className="mx-auto max-w-[1400px] px-5 py-14 md:px-10 md:py-20">
        <div className="relative mb-16 aspect-[21/9] overflow-hidden rounded-3xl bg-ink-900">
          <Image
            src="/video/tie-adjust-poster.webp"
            alt="A man adjusting the knot of a burgundy silk necktie"
            fill
            preload
            sizes="100vw"
            className="object-cover"
          />
        </div>

        <ol className="space-y-16">
          {KNOTS.map((knot, i) => (
            <li key={knot.name} className="grid gap-8 border-t border-cream-300 pt-10 lg:grid-cols-[1fr_1.3fr] lg:gap-16">
              <div>
                <Eyebrow>Knot {String(i + 1).padStart(2, "0")}</Eyebrow>
                <h2 className="font-display mt-4 text-3xl">{knot.name}</h2>
                <p className="mt-4 text-sm leading-relaxed text-ink-600 text-pretty">{knot.body}</p>

                <dl className="mt-7 space-y-3 border-t border-cream-300 pt-5 text-sm">
                  {[
                    ["Difficulty", knot.difficulty],
                    ["Shape", knot.shape],
                    ["Best collar", knot.collar],
                  ].map(([k, v]) => (
                    <div key={k} className="flex gap-4">
                      <dt className="eyebrow w-28 shrink-0 pt-0.5 text-ink-600">{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <ol className="space-y-4">
                {knot.steps.map((step, n) => (
                  <li key={step} className="flex gap-4 rounded-2xl border border-cream-300 bg-cream-100 p-5">
                    <span className="font-display shrink-0 text-lg text-wine-700">{n + 1}</span>
                    <span className="text-sm leading-relaxed text-ink-600">{step}</span>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>

        <div className="mt-20 rounded-3xl bg-wine-800 px-7 py-12 text-center text-cream-100 md:px-14 md:py-16">
          <h2 className="font-display text-3xl text-balance md:text-4xl">
            One last rule
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-cream-100/70 text-pretty md:text-base">
            The tip of the blade should finish at your belt buckle — not above it,
            not over it. And put a dimple under the knot. It takes one second and
            it is the difference between wearing a tie and having one on.
          </p>
          <ButtonLink href="/shop" variant="cream" size="lg" className="mt-8">
            Find your next tie
          </ButtonLink>
        </div>
      </div>
    </>
  );
}
