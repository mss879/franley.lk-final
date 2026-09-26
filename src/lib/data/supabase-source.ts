import "server-only";
import { createAnonClient } from "@/lib/supabase/server";

/*
 * Every read here is public catalogue data, so it goes through the cookie-less
 * anon client. The cookie-bound client would call cookies(), which marks every
 * storefront route dynamic: no static render, no ISR, a database round trip on
 * every page view. RLS is identical either way — a signed-in admin browsing the
 * shop now simply sees what a shopper sees (the queries filter to active rows
 * regardless).
 */
import type { Category, Collection, Product, ProductQuery } from "@/types/domain";

/**
 * Live catalogue reads.
 *
 * Everything goes through `products_public` — a security_invoker view defined
 * in 0003_catalog.sql that already joins the category and aggregates images in
 * position order, so the storefront never needs an embedded select. Collection
 * pages read `collection_products_public` (0013_collections.sql), which is the
 * same row shape plus `collection_slug` and the member's `item_position`.
 */

type PublicRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  price_cents: number;
  compare_at_cents: number | null;
  color_name: string | null;
  color_hex: string | null;
  width_cm: number | string | null;
  stock: number;
  featured: boolean;
  status: Product["status"];
  category_slug: string;
  category_name: string | null;
  images: string[] | null;
};

function toProduct(row: PublicRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description ?? "",
    priceCents: row.price_cents,
    compareAtCents: row.compare_at_cents,
    categorySlug: row.category_slug,
    categoryName: row.category_name,
    colorName: row.color_name,
    colorHex: row.color_hex,
    // numeric(3,1) arrives as a string from PostgREST; normalise and drop a
    // trailing ".0" so the UI reads "6 cm", not "6.0 cm".
    widthCm: row.width_cm == null ? null : String(row.width_cm).replace(/\.0$/, ""),
    images: row.images ?? [],
    featured: row.featured,
    stock: row.stock,
    status: row.status,
  };
}

/**
 * PostgREST types an embedded to-one relation as an array in its generated
 * types even when it resolves to a single row. Normalise both shapes.
 */
type Embedded<T> = T | T[] | null;
function one<T>(value: Embedded<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const ORDER: Record<NonNullable<ProductQuery["sort"]>, [string, boolean]> = {
  "price-asc": ["price_cents", true],
  "price-desc": ["price_cents", false],
  "name-asc": ["title", true],
  newest: ["created_at", false],
  // The admin's hand-set order. Inside a collection that is the member's
  // `item_position`; on the plain catalogue it falls back to the product's own.
  curated: ["position", true],
};

/**
 * `sort` comes from the URL, so it can hold anything. An unknown value must
 * fall back to the default order rather than throw: getProducts() treats a
 * throw as "database unreachable" and serves the seed catalogue, whose
 * `seed-N` ids then fail checkout's uuid cast on a live store.
 */
function isSort(value: unknown): value is keyof typeof ORDER {
  return typeof value === "string" && Object.hasOwn(ORDER, value);
}

/** Child categories roll up into their parent, so /collections/neckties shows both. */
async function categorySlugsFor(
  supabase: ReturnType<typeof createAnonClient>,
  slug: string,
) {
  const { data } = await supabase.from("categories").select("slug, parent:parent_id(slug)");
  const rows = (data ?? []) as unknown as { slug: string; parent: Embedded<{ slug: string }> }[];
  const children = rows.filter((r) => one(r.parent)?.slug === slug).map((r) => r.slug);
  return [slug, ...children];
}

export async function getProductsLive(q: ProductQuery = {}) {
  const supabase = createAnonClient();
  let query = supabase
    .from(q.collectionSlug ? "collection_products_public" : "products_public")
    .select("*", { count: "exact" })
    .eq("status", "active");

  if (q.collectionSlug) query = query.eq("collection_slug", q.collectionSlug);
  if (q.featured) query = query.eq("featured", true);
  if (q.excludeSlug) query = query.neq("slug", q.excludeSlug);
  if (q.colors?.length) query = query.in("color_name", q.colors);
  if (q.search) {
    const needle = q.search.replace(/[%,()]/g, " ").trim();
    if (needle) query = query.or(`title.ilike.%${needle}%,color_name.ilike.%${needle}%`);
  }
  if (q.categorySlug) {
    query = query.in("category_slug", await categorySlugsFor(supabase, q.categorySlug));
  }

  const sort = isSort(q.sort) ? q.sort : q.collectionSlug ? "curated" : "newest";
  const [column, ascending] = ORDER[sort];
  query = query
    .order(sort === "curated" && q.collectionSlug ? "item_position" : column, { ascending })
    .order("id", { ascending: true });

  const offset = q.offset ?? 0;
  if (q.limit) query = query.range(offset, offset + q.limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  return { products: (data ?? []).map((r) => toProduct(r as PublicRow)), total: count ?? 0 };
}

export async function getProductBySlugLive(slug: string): Promise<Product | null> {
  const supabase = createAnonClient();
  const { data, error } = await supabase
    .from("products_public")
    .select("*")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  return data ? toProduct(data as PublicRow) : null;
}

export async function getCategoriesLive(): Promise<Category[]> {
  const supabase = createAnonClient();

  const [{ data, error }, counts] = await Promise.all([
    supabase
      .from("categories")
      .select("id, slug, name, description, position, image_url, parent:parent_id(slug)")
      .eq("is_active", true)
      .order("position", { ascending: true }),
    supabase.from("products_public").select("category_slug").eq("status", "active"),
  ]);
  if (error) throw error;

  const perSlug = new Map<string, number>();
  for (const row of (counts.data ?? []) as { category_slug: string }[]) {
    perSlug.set(row.category_slug, (perSlug.get(row.category_slug) ?? 0) + 1);
  }

  const rows = (data ?? []) as unknown as {
    id: string; slug: string; name: string; description: string | null;
    position: number; image_url: string | null; parent: Embedded<{ slug: string }>;
  }[];

  return rows.map((r) => {
    const own = perSlug.get(r.slug) ?? 0;
    const fromChildren = rows
      .filter((c) => one(c.parent)?.slug === r.slug)
      .reduce((n, c) => n + (perSlug.get(c.slug) ?? 0), 0);
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description,
      parentSlug: one(r.parent)?.slug ?? null,
      position: r.position,
      imageUrl: r.image_url,
      productCount: own + fromChildren,
    };
  });
}

/* ---------------------------------------------------------------------------
 * Collections
 * ------------------------------------------------------------------------- */

type CollectionRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  hero_eyebrow: string | null;
  image_url: string | null;
  position: number;
};

const COLLECTION_SELECT = "id, slug, name, description, hero_eyebrow, image_url, position";

function toCollection(row: CollectionRow, productCount: number): Collection {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    heroEyebrow: row.hero_eyebrow,
    imageUrl: row.image_url,
    position: row.position,
    productCount,
  };
}

/*
 * Members are counted from `collection_products_public` with the same
 * `status = active` filter the collection page lists with, so a count of zero
 * means exactly "this page would be empty". An embedded `collection_products(count)`
 * would not: the join table's RLS shows a signed-in admin every member, drafts
 * included, so the admin and a shopper would disagree about which collections exist.
 */

export async function getCollectionsLive(): Promise<Collection[]> {
  const supabase = createAnonClient();
  const [{ data, error }, members] = await Promise.all([
    supabase
      .from("collections")
      .select(COLLECTION_SELECT)
      .eq("is_active", true)
      .order("position", { ascending: true })
      .order("name", { ascending: true }),
    supabase.from("collection_products_public").select("collection_slug").eq("status", "active"),
  ]);
  if (error) throw error;
  if (members.error) throw members.error;

  const perSlug = new Map<string, number>();
  for (const row of (members.data ?? []) as { collection_slug: string }[]) {
    perSlug.set(row.collection_slug, (perSlug.get(row.collection_slug) ?? 0) + 1);
  }

  return ((data ?? []) as CollectionRow[]).map((row) =>
    toCollection(row, perSlug.get(row.slug) ?? 0),
  );
}

export async function getCollectionBySlugLive(slug: string): Promise<Collection | null> {
  const supabase = createAnonClient();
  const [{ data, error }, members] = await Promise.all([
    supabase
      .from("collections")
      .select(COLLECTION_SELECT)
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("collection_products_public")
      .select("id", { count: "exact", head: true })
      .eq("collection_slug", slug)
      .eq("status", "active"),
  ]);
  if (error) throw error;
  if (members.error) throw members.error;
  return data ? toCollection(data as CollectionRow, members.count ?? 0) : null;
}
