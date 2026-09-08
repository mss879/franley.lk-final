import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Phone, MapPin, Clock, Truck, RotateCcw, HelpCircle } from "lucide-react";
import { PageHeader } from "@/components/site/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { SITE, DELIVERY } from "@/lib/constants";
import { WhatsAppIcon } from "@/components/ui/social-icons";
import { ContactForm } from "@/components/site/contact-form";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Contact Us",
  description: `Reach Franley on WhatsApp at ${SITE.phoneLocal}, by email at ${SITE.email}, or visit us at ${SITE.address.line1}, ${SITE.address.city}.`,
  canonical: "/contact",
});

const DETAILS = [
  {
    Icon: Phone,
    label: "Phone & WhatsApp",
    lines: [SITE.phoneLocal],
    href: `tel:${SITE.whatsapp}`,
  },
  {
    Icon: Mail,
    label: "Email",
    lines: [SITE.email],
    href: `mailto:${SITE.email}`,
  },
  {
    Icon: MapPin,
    label: "Address",
    lines: [SITE.address.line1, `${SITE.address.city}, ${SITE.address.country}`],
    href: null,
  },
  {
    Icon: Clock,
    label: "Business hours",
    lines: [SITE.hours.weekdays, SITE.hours.weekend],
    href: null,
  },
];

/** The three things people actually write in about. */
const QUICK_ANSWERS = [
  {
    Icon: Truck,
    q: "When will my order arrive?",
    a: `Orders are processed within ${DELIVERY.processing}. Colombo and suburbs take ${DELIVERY.colombo}; other areas ${DELIVERY.outstation}. Tracking details are shared once your order is dispatched.`,
    href: "/shipping",
    hrefLabel: "Full shipping policy",
  },
  {
    Icon: RotateCcw,
    q: "Can I return or exchange something?",
    a: `Yes — within ${DELIVERY.returnsWindow} days of delivery, unused and in its original packaging, with your order number. Exchanges depend on stock, so message us early.`,
    href: "/returns",
    hrefLabel: "Full returns policy",
  },
  {
    Icon: HelpCircle,
    q: "Which colour goes with my suit?",
    a: "Send us a photo on WhatsApp. We will tell you honestly what works and what does not, even if the answer is that you already own something better.",
    href: null,
    hrefLabel: null,
  },
];

export default function ContactPage() {
  return (
    <>
      <PageHeader
        eyebrow="We're here to help"
        title="Contact Us"
        lede="Questions about a product, an order on its way, shipping or returns — reach us however suits you. WhatsApp is fastest."
      />

      <div className="mx-auto max-w-[1400px] px-5 py-16 md:px-10 md:py-24">
        <div className="grid gap-14 lg:grid-cols-[1fr_1.05fr] lg:gap-20">
          {/* ---- Details ---- */}
          <div>
            <Eyebrow rule>Customer support</Eyebrow>
            <h2 className="font-display mt-5 text-3xl">Talk to a person</h2>
            <p className="mt-4 text-sm leading-relaxed text-ink-600 text-pretty">
              We are a small team in {SITE.address.city}, so you will be speaking
              to someone who knows what is actually on the shelf.
            </p>

            <dl className="mt-10 space-y-8">
              {DETAILS.map(({ Icon, label, lines, href }) => (
                <div key={label} className="flex gap-4">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-wine-700" strokeWidth={1.5} aria-hidden />
                  <div>
                    <dt className="eyebrow text-ink-600">{label}</dt>
                    <dd className="mt-1.5 space-y-0.5 text-sm leading-relaxed">
                      {href ? (
                        <a
                          href={href}
                          className="transition-colors hover:text-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
                        >
                          {lines[0]}
                        </a>
                      ) : (
                        lines.map((l) => <span key={l} className="block">{l}</span>)
                      )}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>

          </div>

          {/* The form now posts to a server action that emails the shop with
              the sender's address as reply-to. WhatsApp stays alongside it,
              because for most Franley customers it is genuinely faster. */}
          <div className="space-y-4">
            <ContactForm />

            <div className="rounded-3xl border border-cream-300 p-7 md:p-9">
              <p className="text-sm leading-relaxed text-ink-600">
                Prefer to talk? WhatsApp is fastest — send a photo of the suit or
                shirt you are matching and we will answer with what actually works.
              </p>
              <ButtonLink
                href={`https://wa.me/${SITE.whatsapp.replace(/\D/g, "")}`}
                size="lg"
                className="mt-5 w-full"
              >
                <WhatsAppIcon className="h-4 w-4" />
                Message us on WhatsApp
              </ButtonLink>
            </div>
          </div>

        </div>
      </div>

      {/* ---- Quick answers ---- */}
      <section className="border-t border-cream-300 bg-cream-100 py-16 md:py-20">
        <div className="mx-auto max-w-[1400px] px-5 md:px-10">
          <Eyebrow rule>Before you write</Eyebrow>
          <h2 className="font-display mt-5 text-3xl">Answers to the usual three</h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {QUICK_ANSWERS.map(({ Icon, q, a, href, hrefLabel }) => (
              <div key={q} className="border-t border-cream-300 pt-6">
                <Icon className="h-5 w-5 text-wine-700" strokeWidth={1.5} aria-hidden />
                <h3 className="font-display mt-4 text-lg leading-snug">{q}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-ink-600 text-pretty">{a}</p>
                {href && hrefLabel && (
                  <Link
                    href={href}
                    className="eyebrow mt-4 inline-block border-b border-ink-900/25 pb-1 transition-colors hover:border-wine-700 hover:text-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    {hrefLabel}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
