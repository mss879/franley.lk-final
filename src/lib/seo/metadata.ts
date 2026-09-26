import type { Metadata } from "next";
import { SITE } from "@/lib/constants";
import { OG_FALLBACK_IMAGE, OG_LOCALE, absoluteUrl } from "./config";

export type PageSeo = {
  /** Page title without the brand suffix — the root template adds it. */
  title?: string;
  description?: string;
  /** Canonical path, including the query string when the query is part of the page's identity. */
  canonical: string;
  /** Root-relative or absolute image paths. Falls back to the brand card. */
  images?: string[];
  /** Alt text for `images` in link previews — the product or collection name. */
  imageAlt?: string;
  /**
   * og:type. Product pages pass "none" and render `og:type=product` themselves,
   * because Next's OpenGraph union has no product variant.
   */
  ogType?: "website" | "article" | "none";
  noindex?: boolean;
};

/**
 * The single place a Franley page's head is assembled. Every page goes through
 * it so title, description, canonical, Open Graph and Twitter card can never
 * drift apart.
 */
export function buildMetadata({
  title,
  description,
  canonical,
  images,
  imageAlt,
  ogType = "website",
  noindex,
}: PageSeo): Metadata {
  const fullTitle = title ? `${title} · ${SITE.name}` : SITE.seoTitle;
  const desc = description ?? SITE.description;
  const url = absoluteUrl(canonical);
  // The brand card's size is known; a page's own photographs are described by alt only.
  const pictures = images?.length
    ? images.map((src) => ({ url: absoluteUrl(src), ...(imageAlt ? { alt: imageAlt } : {}) }))
    : [{ ...OG_FALLBACK_IMAGE, url: absoluteUrl(OG_FALLBACK_IMAGE.url) }];

  const og = {
    url,
    siteName: SITE.name,
    locale: OG_LOCALE,
    title: fullTitle,
    description: desc,
    images: pictures,
  };

  return {
    ...(title ? { title } : {}),
    description: desc,
    alternates: { canonical: url },
    openGraph:
      ogType === "article"
        ? { ...og, type: "article" }
        : ogType === "website"
          ? { ...og, type: "website" }
          : og,
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: desc,
      images: pictures,
    },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

export type ListingParams = { sort?: string; color?: string; q?: string };

export function activeColors(sp: ListingParams) {
  return (sp.color ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

export function isSearch(sp: ListingParams) {
  return Boolean(sp.q?.trim());
}

/**
 * Which listing query parameters survive into the canonical.
 *
 * `sort` reorders the same set of products, so it never does — otherwise four
 * sort values multiply every listing URL by four. `color` never does either:
 * the colour pills are buttons, not links, so no crawler can find a colour page
 * anyway, and the parameter is free text — `?color=anything` would otherwise be
 * an indexable page titled "anything Neckties" with nothing on it. Colour pages
 * fold back onto the bare listing and are noindexed (see listingNoindex).
 * Search pages keep `q` so their noindex sits on a self-referencing canonical
 * instead of pointing away from the page, which Google reads as a conflicting
 * signal.
 */
export function listingCanonical(basePath: string, sp: ListingParams) {
  const params = new URLSearchParams();
  if (isSearch(sp)) params.set("q", sp.q!.trim());

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/** A filtered or searched listing is for the shopper in front of it, never for the index. */
export function listingNoindex(sp: ListingParams) {
  return isSearch(sp) || activeColors(sp).length > 0;
}
