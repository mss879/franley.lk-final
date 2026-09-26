import type { MetadataRoute } from "next";
import { getCategories, getCollections, getProducts, isLive } from "@/lib/data";
import { CONTENT_REVISED, absoluteUrl } from "@/lib/seo";
import { createAnonClient } from "@/lib/supabase/server";

/**
 * Only pages worth a crawl budget. /cart, /checkout, /order/* and /admin/*
 * are deliberately absent — they are private or transactional, and robots.ts
 * disallows them as well.
 *
 * lastModified is each row's real updated_at, so a crawler can tell which
 * pages actually changed. Pages with no row of their own report the launch
 * revision (listings: the newest product edit, if later). Never `new Date()`:
 * telling Google the whole site changed on every crawl teaches it to ignore
 * the field.
 *
 * Admin saves call revalidatePath("/", "layout"), which refreshes this too;
 * the hourly revalidate is only a backstop.
 */
export const revalidate = 3600;

type Entry = { path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number };

const STATIC_PAGES: Entry[] = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/shop", changeFrequency: "daily", priority: 0.9 },
  { path: "/collections", changeFrequency: "weekly", priority: 0.8 },
  { path: "/about", changeFrequency: "monthly", priority: 0.6 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.6 },
  { path: "/tie-guide", changeFrequency: "yearly", priority: 0.5 },
  { path: "/care", changeFrequency: "yearly", priority: 0.4 },
  { path: "/shipping", changeFrequency: "yearly", priority: 0.4 },
  { path: "/returns", changeFrequency: "yearly", priority: 0.4 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.2 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.2 },
];

/** Pages whose content is the product listing itself. */
const LISTING_PAGES = new Set(["", "/shop", "/collections"]);

/**
 * slug → last edit for one catalogue table, read as a signed-out visitor so
 * RLS returns active rows only. Empty on the seed catalogue or on any error,
 * and every entry then falls back to CONTENT_REVISED.
 */
async function lastEdited(table: "products" | "categories" | "collections") {
  const edited = new Map<string, Date>();
  if (!isLive()) return edited;
  try {
    const { data, error } = await createAnonClient().from(table).select("slug, updated_at").range(0, 4999);
    if (error) throw error;
    for (const row of (data ?? []) as { slug: string; updated_at: string }[]) {
      const at = new Date(row.updated_at);
      if (!Number.isNaN(at.getTime())) edited.set(row.slug, at);
    }
  } catch (err) {
    console.error(`sitemap: could not read ${table}.updated_at`, err);
  }
  return edited;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ products, total }, categories, collections, productEdits, categoryEdits, collectionEdits] =
    await Promise.all([
      getProducts({}),
      getCategories(),
      getCollections(),
      lastEdited("products"),
      lastEdited("categories"),
      lastEdited("collections"),
    ]);

  if (total > products.length) {
    console.error(`sitemap: ${total} products but only ${products.length} returned; the rest are missing from sitemap.xml`);
  }

  const newestProductEdit = [...productEdits.values()].reduce(
    (latest, at) => (at > latest ? at : latest),
    CONTENT_REVISED,
  );

  return [
    ...STATIC_PAGES.map((page) => ({
      url: absoluteUrl(page.path || "/"),
      lastModified: LISTING_PAGES.has(page.path) ? newestProductEdit : CONTENT_REVISED,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    })),
    // Categories and curated collections share /collections/<slug>; the
    // database keeps the two slug sets disjoint, so no URL appears twice.
    ...collections.map((listing) => ({
      url: absoluteUrl(`/collections/${listing.slug}`),
      lastModified: collectionEdits.get(listing.slug) ?? CONTENT_REVISED,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...categories.map((listing) => ({
      url: absoluteUrl(`/collections/${listing.slug}`),
      lastModified: categoryEdits.get(listing.slug) ?? CONTENT_REVISED,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...products.map((product) => ({
      url: absoluteUrl(`/products/${product.slug}`),
      lastModified: productEdits.get(product.slug) ?? CONTENT_REVISED,
      changeFrequency: "weekly" as const,
      priority: 0.7,
      ...(product.images.length ? { images: product.images.map(absoluteUrl) } : {}),
    })),
  ];
}
