import Image from "next/image";
import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { FacebookIcon, InstagramIcon, WhatsAppIcon } from "@/components/ui/social-icons";
import { SITE } from "@/lib/constants";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getSiteSettings } from "@/lib/settings";
import { getCollections } from "@/lib/data";
import { waLink } from "@/lib/settings/shipping";

const COLUMNS = [
  {
    title: "Shop",
    links: [
      { href: "/shop", label: "All Products" },
      { href: "/collections/plain-ties", label: "Plain Ties" },
      { href: "/collections/striped-ties", label: "Striped Ties" },
      { href: "/collections/cufflinks", label: "Cufflinks" },
    ],
  },
  {
    title: "Help",
    links: [
      { href: "/contact", label: "Contact Us" },
      { href: "/about", label: "About Us" },
      { href: "/tie-guide", label: "How to Tie a Knot" },
      { href: "/care", label: "Fabric Care" },
    ],
  },
  {
    // Named exactly as on franley.lk, so returning customers find them.
    title: "Policies",
    links: [
      { href: "/shipping", label: "Shipping Policy" },
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/returns", label: "Return & Refund Policy" },
      { href: "/terms", label: "Terms & Conditions" },
    ],
  },
] as const;

// Only channels that resolve to a real Franley account belong here. The
// Instagram and Facebook entries used to point at the bare platform homepages,
// which dropped a shopper on a logged-out feed; they now appear only once the
// owner enters the real profile address in /admin/settings.
export async function Footer() {
  const [s, collections] = await Promise.all([getSiteSettings(), getCollections()]);
  const SOCIAL = [
    { href: waLink(s.whatsapp), label: "WhatsApp", Icon: WhatsAppIcon },
    ...(s.instagram ? [{ href: s.instagram, label: "Instagram", Icon: InstagramIcon }] : []),
    ...(s.facebook ? [{ href: s.facebook, label: "Facebook", Icon: FacebookIcon }] : []),
  ];
  // Collections the owner creates in the admin join the Shop column; the
  // category links stay first so the footer never loses its fixed shape.
  const columns = COLUMNS.map((col) =>
    col.title === "Shop"
      ? {
          ...col,
          links: [
            ...col.links,
            ...collections.slice(0, 4).map((c) => ({ href: `/collections/${c.slug}`, label: c.name })),
            // The index page was otherwise reachable from the sitemap alone.
            { href: "/collections", label: "All collections" },
          ],
        }
      : col,
  );
  return (
    <footer className="silk-texture bg-wine-900 text-cream-100">
      <div className="mx-auto max-w-[1400px] px-5 py-16 md:px-10 md:py-24">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_2fr]">
          <div className="max-w-sm">
            <Image
              src="/brand/logo-dark.png"
              alt="Franley"
              width={180}
              height={36}
              className="h-7 w-auto brightness-0 invert"
            />
            <p className="mt-6 text-sm leading-relaxed text-cream-100/65">
              {SITE.description}
            </p>

            <address className="mt-8 not-italic">
              <p className="eyebrow text-champagne-300">Customer support</p>
              <p className="mt-3 text-sm leading-relaxed text-cream-100/70">
                {SITE.address.line1}
                <br />
                {SITE.address.city}
                <br />
                {SITE.address.country}
              </p>
            </address>

            <div className="mt-6 flex flex-col gap-3 text-sm">
              <a
                href={`tel:${s.phone.replace(/[^\d+]/g, "")}`}
                className="inline-flex items-center gap-3 text-cream-100/80 transition-colors hover:text-champagne-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-on-wine focus-visible:ring-offset-wine-900"
              >
                <Phone className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
                {s.phone}
              </a>
              <a
                href={`mailto:${s.email}`}
                className="inline-flex items-center gap-3 text-cream-100/80 transition-colors hover:text-champagne-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-on-wine focus-visible:ring-offset-wine-900"
              >
                <Mail className="h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
                {s.email}
              </a>
            </div>

            <p className="mt-6 text-xs leading-relaxed text-cream-100/50">
              {SITE.hours.weekdays}
              <br />
              {SITE.hours.weekend}
            </p>

            <div className="mt-8 flex gap-3">
              {SOCIAL.map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="grid h-11 w-11 place-items-center rounded-full border border-cream-100/20 transition-colors duration-300 hover:border-champagne-400 hover:text-champagne-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-on-wine focus-visible:ring-offset-wine-900"
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden />
                </a>
              ))}
            </div>
          </div>

          <div className="grid gap-10 sm:grid-cols-3">
            {columns.map((col) => (
              <div key={col.title}>
                <Eyebrow tone="light">{col.title}</Eyebrow>
                <ul className="mt-5 space-y-3">
                  {col.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-cream-100/65 transition-colors duration-300 hover:text-cream-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-on-wine focus-visible:ring-offset-wine-900"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-cream-100/12 pt-8 text-xs text-cream-100/50 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} {s.storeName}. All rights reserved.</p>
          <p>Islandwide delivery across Sri Lanka &middot; Prices in LKR</p>
        </div>
      </div>
    </footer>
  );
}
