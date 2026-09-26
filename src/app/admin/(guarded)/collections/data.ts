import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Admin-side reads of collections. RLS lets an admin see hidden collections
 * and every member regardless of the product's status, so the member counts
 * here are deliberately richer than the storefront's.
 */

export type CollectionRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  heroEyebrow: string | null;
  imageUrl: string | null;
  position: number;
  isActive: boolean;
  /** Every member, live or not. */
  memberCount: number;
};

type RawCollection = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  hero_eyebrow: string | null;
  image_url: string | null;
  position: number;
  is_active: boolean;
  collection_products: { count: number }[] | null;
};

const SELECT =
  "id, slug, name, description, hero_eyebrow, image_url, position, is_active, collection_products(count)";

function toRow(raw: RawCollection): CollectionRow {
  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.name,
    description: raw.description,
    heroEyebrow: raw.hero_eyebrow,
    imageUrl: raw.image_url,
    position: raw.position,
    isActive: raw.is_active,
    memberCount: raw.collection_products?.[0]?.count ?? 0,
  };
}

const byPosition = (a: CollectionRow, b: CollectionRow) =>
  a.position - b.position || a.name.localeCompare(b.name);

export type CollectionListRow = CollectionRow & {
  /**
   * Active members only. The storefront hides a collection with none, so an
   * active collection at zero is switched on but not yet visible.
   */
  liveCount: number;
};

export async function listCollections(): Promise<CollectionListRow[]> {
  const supabase = await createClient();
  const [{ data, error }, live] = await Promise.all([
    supabase.from("collections").select(SELECT),
    supabase.from("collection_products_public").select("collection_id").eq("status", "active"),
  ]);
  if (error) throw error;
  if (live.error) throw live.error;

  const perId = new Map<string, number>();
  for (const row of (live.data ?? []) as { collection_id: string }[]) {
    perId.set(row.collection_id, (perId.get(row.collection_id) ?? 0) + 1);
  }

  return ((data ?? []) as unknown as RawCollection[])
    .map((raw) => ({ ...toRow(raw), liveCount: perId.get(raw.id) ?? 0 }))
    .sort(byPosition);
}

export async function getCollection(id: string): Promise<CollectionRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("collections").select(SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toRow(data as unknown as RawCollection) : null;
}

/** The next free slot, so a new collection lands at the end of the list. */
export function nextPosition(all: CollectionRow[]) {
  return all.length ? Math.max(...all.map((c) => c.position)) + 1 : 0;
}

export type ProductStatus = "active" | "draft" | "archived";

export type CollectionMember = {
  id: string;
  title: string;
  slug: string;
  status: ProductStatus;
  priceCents: number;
  stock: number;
  image: string | null;
  position: number;
};

type RawProduct = {
  id: string;
  title: string;
  slug: string;
  status: ProductStatus;
  price_cents: number;
  stock: number;
  product_images: { url: string }[] | null;
};

const PRODUCT_SELECT = "id, title, slug, status, price_cents, stock, product_images(url)";

/** Products with their first image, in whichever order the caller asks for. */
function productsQuery(supabase: Awaited<ReturnType<typeof createClient>>) {
  return supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .order("position", { ascending: true, referencedTable: "product_images" })
    .limit(1, { referencedTable: "product_images" });
}

/**
 * Members in their hand-set order. Two reads rather than one nested embed:
 * PostgREST cannot order a parent row by a child column, and the product
 * details come from the same select the picker uses.
 */
export async function getCollectionMembers(collectionId: string): Promise<CollectionMember[]> {
  const supabase = await createClient();
  const { data: links, error } = await supabase
    .from("collection_products")
    .select("product_id, position, created_at")
    .eq("collection_id", collectionId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;

  const rows = (links ?? []) as { product_id: string; position: number }[];
  if (rows.length === 0) return [];

  const { data: products, error: productError } = await productsQuery(supabase).in(
    "id",
    rows.map((r) => r.product_id),
  );
  if (productError) throw productError;

  const byId = new Map(((products ?? []) as unknown as RawProduct[]).map((p) => [p.id, p]));

  return rows.flatMap((link) => {
    const p = byId.get(link.product_id);
    // A member whose product vanished mid-request is skipped, not rendered blank.
    if (!p) return [];
    return [
      {
        id: p.id,
        title: p.title,
        slug: p.slug,
        status: p.status,
        priceCents: p.price_cents,
        stock: p.stock,
        image: p.product_images?.[0]?.url ?? null,
        position: link.position,
      },
    ];
  });
}

export type PickerProduct = {
  id: string;
  title: string;
  slug: string;
  status: ProductStatus;
  image: string | null;
};

/** The whole catalogue, for the add-products picker. Small enough to filter client-side. */
export async function listPickerProducts(): Promise<PickerProduct[]> {
  const supabase = await createClient();
  const { data, error } = await productsQuery(supabase).order("title", { ascending: true });
  if (error) throw error;

  return ((data ?? []) as unknown as RawProduct[]).map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    status: p.status,
    image: p.product_images?.[0]?.url ?? null,
  }));
}
