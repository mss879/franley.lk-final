import type { Metadata } from "next";
import { SITE } from "@/lib/constants";
import { OG_FALLBACK, OG_LOCALE, absoluteUrl } from "./config";

export type PageSeo = {
  /** Page title without the brand suffix — the root template adds it. */
  title?: string;
  description?: string;
  /** Canonical path, including the query string when the query is part of the page's identity. */
  canonical: string;
  /** Root-relative or absolute image paths. Falls back to the brand card. */
  images?: string[];
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
  ogType = "website",
  noindex,
}: PageSeo): Metadata {
  const fullTitle = title ? `${title} · ${SITE.name}` : `${SITE.name} — ${SITE.tagline}`;
  const desc = description ?? SITE.description;
  const url = absoluteUrl(canonical);
  const pictures = (images?.length ? images : [OG_FALLBACK]).map(absoluteUrl);

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
 * sort values multiply every listing URL by four. A *single* colour is a real
 * facet with its own demand ("navy tie") and keeps a self-referencing
 * canonical; a multi-colour combination is one of hundreds of thin permutations
 * and folds back onto the bare path. Search pages keep `q` so their noindex
 * sits on a self-referencing canonical instead of pointing away from the page,
 * which Google reads as a conflicting signal.
 */
export function listingCanonical(basePath: string, sp: ListingParams) {
  const params = new URLSearchParams();
  const colors = activeColors(sp);

  if (isSearch(sp)) params.set("q", sp.q!.trim());
  else if (colors.length === 1) params.set("color", colors[0]);

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}
