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
  featured?: boolean;
  search?: string;
  colors?: string[];
  sort?: "newest" | "price-asc" | "price-desc" | "name-asc";
  limit?: number;
  offset?: number;
  excludeSlug?: string;
};
