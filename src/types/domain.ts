/** Domain shapes the UI renders. Adapters map DB rows onto these. */

export type Category = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  parentSlug: string | null;
  position: number;
  imageUrl: string | null;
  productCount?: number;
};

/**
 * A hand-picked set of products, many-to-many with the catalogue. Shares the
 * /collections/<slug> namespace with categories, which the database enforces.
 */
export type Collection = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  /** Small label above the name on its page, e.g. "Gifting". */
  heroEyebrow: string | null;
  imageUrl: string | null;
  position: number;
  productCount?: number;
};

export type Product = {
  id: string;
  slug: string;
  title: string;
  description: string;
  priceCents: number;
  compareAtCents: number | null;
  categorySlug: string;
  categoryName: string | null;
  colorName: string | null;
  colorHex: string | null;
  widthCm: string | null;
  images: string[];
  featured: boolean;
  stock: number;
  status: "active" | "draft" | "archived";
};

export type ProductQuery = {
  categorySlug?: string;
  /** Members of one collection. `curated` sort then follows the admin's hand-set order. */
  collectionSlug?: string;
  featured?: boolean;
  search?: string;
  colors?: string[];
  sort?: "newest" | "price-asc" | "price-desc" | "name-asc" | "curated";
  limit?: number;
  offset?: number;
  excludeSlug?: string;
};
