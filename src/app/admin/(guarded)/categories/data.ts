import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Admin-side reads of the category tree. RLS lets an admin see inactive
 * categories and non-active products, so these counts are deliberately richer
 * than the storefront's — the roll-up figure still matches getCategoriesLive
 * so the two pages never disagree about what a shopper sees.
 */

export type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  parentId: string | null;
  position: number;
  imageUrl: string | null;
  isActive: boolean;
};

export type CategoryNode = CategoryRow & {
  children: CategoryNode[];
  /** Active products assigned directly to this category. */
  liveCount: number;
  /** Draft or archived products assigned directly to this category. */
  hiddenCount: number;
  /** liveCount plus every child's liveCount — what the storefront tile shows. */
  rollupLiveCount: number;
};

type RawCategory = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  position: number;
  image_url: string | null;
  is_active: boolean;
};

const SELECT = "id, slug, name, description, parent_id, position, image_url, is_active";

function toRow(raw: RawCategory): CategoryRow {
  return {
    id: raw.id,
    slug: raw.slug,
    name: raw.name,
    description: raw.description,
    parentId: raw.parent_id,
    position: raw.position,
    imageUrl: raw.image_url,
    isActive: raw.is_active,
  };
}

const byPosition = (a: CategoryRow, b: CategoryRow) =>
  a.position - b.position || a.name.localeCompare(b.name);

export async function listCategories(): Promise<CategoryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("categories").select(SELECT);
  if (error) throw error;
  return ((data ?? []) as RawCategory[]).map(toRow).sort(byPosition);
}

export async function getCategoryTree() {
  const supabase = await createClient();

  const [rows, products] = await Promise.all([
    listCategories(),
    supabase.from("products").select("category_id, status"),
  ]);

  if (products.error) throw products.error;

  const live = new Map<string, number>();
  const hidden = new Map<string, number>();
  for (const p of (products.data ?? []) as { category_id: string; status: string }[]) {
    const bucket = p.status === "active" ? live : hidden;
    bucket.set(p.category_id, (bucket.get(p.category_id) ?? 0) + 1);
  }

  const childrenOf = new Map<string, CategoryRow[]>();
  for (const row of rows) {
    if (!row.parentId) continue;
    const list = childrenOf.get(row.parentId) ?? [];
    list.push(row);
    childrenOf.set(row.parentId, list);
  }

  const build = (row: CategoryRow): CategoryNode => {
    const children = (childrenOf.get(row.id) ?? []).map(build);
    const liveCount = live.get(row.id) ?? 0;
    return {
      ...row,
      children,
      liveCount,
      hiddenCount: hidden.get(row.id) ?? 0,
      rollupLiveCount: liveCount + children.reduce((n, c) => n + c.liveCount, 0),
    };
  };

  // parent_id is a real foreign key and an admin's RLS view holds every row,
  // so every child's parent is present and nothing is stranded.
  return { tree: rows.filter((row) => !row.parentId).map(build), all: rows };
}

/** Top-level categories a category may be filed under, minus itself. */
export function eligibleParents(all: CategoryRow[], selfId: string | null) {
  return all.filter((row) => !row.parentId && row.id !== selfId).sort(byPosition);
}

export type CategoryProduct = {
  id: string;
  title: string;
  slug: string;
  status: "active" | "draft" | "archived";
  priceCents: number;
  stock: number;
};

export async function getProductsInCategory(categoryId: string): Promise<CategoryProduct[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, title, slug, status, price_cents, stock")
    .eq("category_id", categoryId)
    .order("position", { ascending: true })
    .order("title", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as {
    id: string;
    title: string;
    slug: string;
    status: CategoryProduct["status"];
    price_cents: number;
    stock: number;
  }[]).map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    status: p.status,
    priceCents: p.price_cents,
    stock: p.stock,
  }));
}

/** The next free slot at a level, so a new category lands at the end. */
export function nextPosition(all: CategoryRow[], parentId: string | null) {
  const siblings = all.filter((row) => (row.parentId ?? null) === parentId);
  return siblings.length ? Math.max(...siblings.map((s) => s.position)) + 1 : 0;
}
