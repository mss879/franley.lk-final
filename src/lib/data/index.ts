import "server-only";
import { seedCategories, seedProducts } from "./seed-source";
import type { Category, Collection, Product, ProductQuery } from "@/types/domain";

/**
 * Single entry point for catalogue reads. Prefers Supabase; falls back to the
 * bundled seed so the storefront renders before the client has run the
 * migrations. `isLive()` tells the UI which mode it is in.
 *
 * The seed is a stand-in for an *unreachable* database, never for an answer
 * the database gave: a live "not found" or an empty list is returned as-is.
 * Otherwise a product the admin has set to draft would keep rendering from
 * the seed, and a catalogue the admin emptied would refill itself.
 */
export function isLive() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return Boolean(url && !url.includes("YOUR-PROJECT-REF"));
}

function sortProducts(list: Product[], sort: ProductQuery["sort"]) {
  const out = [...list];
  switch (sort) {
    case "price-asc": return out.sort((a, b) => a.priceCents - b.priceCents);
    case "price-desc": return out.sort((a, b) => b.priceCents - a.priceCents);
    case "name-asc": return out.sort((a, b) => a.title.localeCompare(b.title));
    default: return out;
  }
}

/** Child slugs roll up into their parent, so /collections/neckties shows both. */
function inCategory(product: Product, slug: string, cats: Category[]) {
  if (product.categorySlug === slug) return true;
  return cats.some((c) => c.parentSlug === slug && c.slug === product.categorySlug);
}

async function seedQuery(q: ProductQuery = {}) {
  // Collections only exist in the database; the seed has no membership data.
  if (q.collectionSlug) return { products: [] as Product[], total: 0 };

  let list = seedProducts.filter((p) => p.status === "active");
  if (q.categorySlug) list = list.filter((p) => inCategory(p, q.categorySlug!, seedCategories));
  if (q.featured) list = list.filter((p) => p.featured);
  if (q.excludeSlug) list = list.filter((p) => p.slug !== q.excludeSlug);
  if (q.colors?.length) list = list.filter((p) => p.colorName && q.colors!.includes(p.colorName));
  if (q.search) {
    const needle = q.search.toLowerCase();
    list = list.filter(
      (p) =>
        p.title.toLowerCase().includes(needle) ||
        p.description.toLowerCase().includes(needle) ||
        (p.colorName ?? "").toLowerCase().includes(needle),
    );
  }
  list = sortProducts(list, q.sort);
  const total = list.length;
  const offset = q.offset ?? 0;
  return { products: list.slice(offset, offset + (q.limit ?? list.length)), total };
}

export async function getProducts(q: ProductQuery = {}) {
  if (!isLive()) return seedQuery(q);
  const { getProductsLive } = await import("./supabase-source");
  try {
    return await getProductsLive(q);
  } catch {
    // A misconfigured or unreachable project must not blank the storefront.
    return seedQuery(q);
  }
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const fromSeed = () => seedProducts.find((p) => p.slug === slug) ?? null;
  if (!isLive()) return fromSeed();

  const { getProductBySlugLive } = await import("./supabase-source");
  try {
    // null here means the product is missing, draft or archived — a real answer.
    return await getProductBySlugLive(slug);
  } catch {
    return fromSeed();
  }
}

export async function getCategories(): Promise<Category[]> {
  if (!isLive()) return seedCategories;

  const { getCategoriesLive } = await import("./supabase-source");
  try {
    // An empty list is a real answer too: the admin has hidden every category.
    return await getCategoriesLive();
  } catch {
    return seedCategories;
  }
}

export async function getCategoryBySlug(slug: string) {
  return (await getCategories()).find((c) => c.slug === slug) ?? null;
}

/**
 * A collection is public only while it is active AND holds at least one
 * active product. An empty one has no card on /collections, no footer link,
 * no sitemap entry, and its page 404s — until it has something to show.
 */
const hasProducts = (collection: Collection) => (collection.productCount ?? 0) > 0;

/** Public collections in display order. Nothing to fall back on: the seed has none. */
export async function getCollections(): Promise<Collection[]> {
  if (!isLive()) return [];

  const { getCollectionsLive } = await import("./supabase-source");
  try {
    return (await getCollectionsLive()).filter(hasProducts);
  } catch {
    return [];
  }
}

export async function getCollectionBySlug(slug: string): Promise<Collection | null> {
  if (!isLive()) return null;

  const { getCollectionBySlugLive } = await import("./supabase-source");
  try {
    const collection = await getCollectionBySlugLive(slug);
    return collection && hasProducts(collection) ? collection : null;
  } catch {
    return null;
  }
}

export async function getAllProductSlugs() {
  const { products } = await getProducts({});
  return products.map((p) => p.slug);
}
