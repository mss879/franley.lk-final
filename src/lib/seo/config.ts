import { siteUrl } from "@/lib/env";

/** Canonical origin, without a trailing slash. Env wins so staging self-canonicalises. */
export const SITE_ORIGIN = siteUrl();

/** Sri Lankan English. Used for og:locale, <html lang> and schema inLanguage. */
export const OG_LOCALE = "en_LK";
export const HTML_LANG = "en-LK";

/** Brand card for every page that has no photograph of its own. */
export const OG_FALLBACK = "/brand/og-hero.jpg";
/** Its real pixel size and a description, so link previews can lay it out before it loads. */
export const OG_FALLBACK_IMAGE = {
  url: OG_FALLBACK,
  width: 1920,
  height: 1080,
  alt: "Franley neckties and cufflinks",
} as const;

/**
 * Launch revision date: the sitemap's lastModified for pages with no database
 * row of their own, and for everything while the site runs on the bundled
 * seed catalogue — rather than each crawl being told everything changed a
 * second ago.
 */
export const CONTENT_REVISED = new Date("2026-09-08T00:00:00.000Z");

export function absoluteUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Cents to the decimal string schema.org expects: 119000 → "1190.00". */
export function schemaPrice(cents: number) {
  return (cents / 100).toFixed(2);
}

/** Cents to display copy for meta descriptions: 119000 → "Rs 1,190". */
export function copyPrice(cents: number) {
  return `Rs ${new Intl.NumberFormat("en-LK", { maximumFractionDigits: 0 }).format(cents / 100)}`;
}

/** Trim to a description length search engines will actually render, on a word boundary. */
export function clamp(text: string, max = 160) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.—-]$/, "")}…`;
}
