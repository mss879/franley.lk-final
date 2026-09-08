import type { MetadataRoute } from "next";
import { getProducts, getCategories } from "@/lib/data";
import { CONTENT_REVISED, absoluteUrl } from "@/lib/seo";

/**
 * Only pages worth a crawl budget. /cart, /checkout, /order/* and /admin/*
 * are deliberately absent — they are private or transactional, and robots.ts
 * disallows them as well.
 *
 * Neither the seed catalogue nor `products_public` carries an updated_at, so
 * every entry reports the launch revision. Stamping `new Date()` would tell
 * Google the whole site changed on every crawl, which it learns to ignore.
 */

type Entry = { path: string; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number };

const STATIC_PAGES: Entry[] = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/shop", changeFrequency: "daily", priority: 0.9 },
  { path: "/about", changeFrequency: "monthly", priority: 0.6 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.6 },
  { path: "/tie-guide", changeFrequency: "yearly", priority: 0.5 },
  { path: "/care", changeFrequency: "yearly", priority: 0.4 },
  { path: "/shipping", changeFrequency: "yearly", priority: 0.4 },
  { path: "/returns", changeFrequency: "yearly", priority: 0.4 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.2 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.2 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ products }, categories] = await Promise.all([getProducts({}), getCategories()]);

  return [
    ...STATIC_PAGES.map((page) => ({
      url: absoluteUrl(page.path || "/"),
      lastModified: CONTENT_REVISED,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    })),
    ...categories.map((category) => ({
      url: absoluteUrl(`/collections/${category.slug}`),
      lastModified: CONTENT_REVISED,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...products.map((product) => ({
      url: absoluteUrl(`/products/${product.slug}`),
      lastModified: CONTENT_REVISED,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
