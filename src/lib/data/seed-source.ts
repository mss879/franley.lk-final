import "server-only";
import seed from "@/../data/seed.json";
import type { Category, Product } from "@/types/domain";

/**
 * Fallback catalogue read straight from the scraped seed file.
 * Used until Supabase credentials are configured, so the storefront is
 * viewable the moment you clone the repo. Once the migrations are applied and
 * env vars are set, the Supabase source takes over — see ./index.ts.
 */

type SeedProduct = (typeof seed.products)[number];
type SeedCategory = (typeof seed.categories)[number];

const categoryName = (slug: string) =>
  seed.categories.find((c) => c.slug === slug)?.name ?? null;

export const seedCategories: Category[] = (seed.categories as SeedCategory[]).map((c, i) => ({
  id: `seed-cat-${i}`,
  slug: c.slug,
  name: c.name,
  description: c.description,
  parentSlug: c.parent,
  position: c.position,
  // Left null so the storefront falls back to its editorial banner; the CMS
  // and the admin category form can set a real image here.
  imageUrl: null,
  productCount: seed.products.filter((p) => {
    if (p.category === c.slug) return true;
    // Roll children up into their parent. The old test was a string prefix
    // match, and no child slug ("plain-ties", "striped-ties") starts with its
    // parent's ("neckties"), so parent counts always came out 0.
    const own = seed.categories.find((k) => k.slug === p.category);
    return own?.parent === c.slug;
  }).length,
}));

export const seedProducts: Product[] = (seed.products as SeedProduct[]).map((p, i) => ({
  id: `seed-${i}`,
  slug: p.slug,
  title: p.title,
  description: p.description,
  priceCents: p.price_cents,
  compareAtCents: p.compare_at_cents,
  categorySlug: p.category,
  categoryName: categoryName(p.category),
  colorName: p.color_name,
  colorHex: p.color_hex,
  widthCm: p.width_cm,
  images: p.images,
  featured: p.featured,
  stock: p.stock,
  status: "active",
}));
