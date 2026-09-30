import type { Metadata } from "next";
import Image from "next/image";
import { PageHeader } from "@/components/site/page-header";
import { SectionHeading } from "@/components/ui/section-heading";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ValueProps } from "@/components/site/value-props";
import { SITE } from "@/lib/constants";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "About Us",
  description:
    "FRANLEY is a Sri Lankan men's accessories brand for the modern gentleman — neckties, cufflinks and finishing pieces made for work, weddings and gifting.",
  canonical: "/about",
});

const CRAFT = [
  {
    n: "01",
    title: "Fabric feel",
    body:
      "A tie is judged by hand before it is judged by eye. We pick cloth with enough body to hold a knot and enough give to fall straight, then check every roll for the weight and the hand before it goes near a cutting table.",
  },
  {
    n: "02",
    title: "Craftsmanship",
    body:
      "Blades are cut on the bias, backed with a soft interlining and closed with a slip stitch down the seam. It is the slower way to make a tie, and the only way one hangs true instead of twisting toward a shoulder by lunchtime.",
  },
  {
    n: "03",
    title: "Presentation",
    body:
      "Everything arrives ready to hand over. Cufflinks come boxed with a matching clip; ties are rolled, wrapped and sealed. If it is a gift, you should not have to do anything to it first.",
  },
];

const NUMBERS = [
  { value: "25", label: "Districts we deliver to" },
  { value: "1–3", label: "Working days, Colombo" },
  { value: "7", label: "Day return window" },
  { value: "6 day", label: "WhatsApp support week" },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="Our story"
        title="Dress sharp, with ease"
        lede="FRANLEY is a Sri Lankan men's accessories brand built for the modern gentleman — timeless essentials designed to lift what you already own."
      />

      {/* ---- Positioning ---- */}
      <section className="mx-auto max-w-[1400px] px-5 py-16 md:px-10 md:py-24">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
          <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-ink-900 lg:sticky lg:top-28 lg:h-fit">
            <Image
              src="/editorial/desk-ties.webp"
              alt="Franley silk neckties laid across a writing desk beside a decanter and a leather notebook"
              fill
              preload
              sizes="(max-width: 1024px) 100vw, 520px"
              className="object-cover"
            />
          </div>

          <div>
            <Eyebrow rule>What we make</Eyebrow>
            <h2 className="font-display mt-5 text-3xl leading-tight text-balance md:text-4xl">
              Timeless essentials, not seasonal noise
            </h2>
            <div className="mt-6 space-y-5 text-sm leading-[1.9] text-ink-600 text-pretty md:text-base">
              <p>
                We focus on the pieces a man actually reaches for — neckties,
                cufflinks and the small finishing details that sit between a
                decent outfit and a considered one. The range is deliberately
                tight. We would rather carry a few dozen things worth owning
                than three hundred worth scrolling past.
              </p>
              <p>
                We believe confidence is in the details. That is why we pay
                attention to fabric feel, craftsmanship and presentation, so
                every piece you wear feels refined, purposeful, and worth it.
                Nothing here is loud. A Franley tie should be the quietest thing
                you have on and still the thing someone mentions.
              </p>
              <p>
                Whether it is for work, a wedding, or a gift you have left a
                little late, Franley is here to help you dress sharp with ease —
                delivered anywhere on the island, with someone on WhatsApp if
                you want a second opinion on the colour first.
              </p>
            </div>

            <dl className="mt-12 grid grid-cols-2 gap-x-6 gap-y-8 border-t border-cream-300 pt-10 sm:grid-cols-4">
              {NUMBERS.map((n) => (
                <div key={n.label}>
                  <dt className="font-display text-3xl text-ink-900">{n.value}</dt>
                  <dd className="mt-1.5 text-xs leading-snug text-ink-600">{n.label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ---- Craft ---- */}
      <section className="silk-texture bg-ink-900 py-20 text-cream-100 md:py-28">
        <div className="mx-auto max-w-[1400px] px-5 md:px-10">
          <SectionHeading
            tone="light"
            eyebrow="How a Franley piece is made"
            title="Three things we refuse to rush"
            lede="The parts of the process nobody photographs, which are the parts that decide whether you still wear it next year."
          />
          <ol className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
            {CRAFT.map((step) => (
              <li key={step.n} className="border-t border-cream-100/15 pt-6">
                <span className="font-display text-2xl text-champagne-300">{step.n}</span>
                <h3 className="font-display mt-3 text-xl">{step.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-cream-100/70 text-pretty">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---- Where to find us ---- */}
      <section className="mx-auto max-w-[1400px] px-5 py-20 md:px-10 md:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <Eyebrow rule>Based in Dehiwala</Eyebrow>
            <h2 className="font-display mt-5 text-3xl leading-tight text-balance md:text-4xl">
              A small team you can actually reach
            </h2>
            <p className="mt-5 text-sm leading-relaxed text-ink-600 text-pretty md:text-base">
              We work out of {SITE.address.line1}, {SITE.address.city}. Orders are
              packed here, questions are answered here, and the person who replies
              on WhatsApp is the person who knows what is in stock. If something
              goes wrong, you are not filing a ticket into a void.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/shop" size="lg">Shop the collection</ButtonLink>
              <ButtonLink href="/contact" variant="outline" size="lg">Talk to us</ButtonLink>
            </div>
          </div>

          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-ink-900">
            <Image
              src="/editorial/brand-box.webp"
              alt="A Franley presentation box holding rolled silk ties and cufflinks"
              fill
              sizes="(max-width: 1024px) 100vw, 620px"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <ValueProps />
    </>
  );
}
