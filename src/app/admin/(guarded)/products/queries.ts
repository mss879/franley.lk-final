import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CategoryOption } from "@/components/admin/products/shared";

/**
 * PostgREST types an embedded to-one relation as an array in its generated
 * types even when it resolves to a single row. Normalise both shapes.
 */
type Embedded<T> = T | T[] | null;
export function one<T>(value: Embedded<T>): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

/** Every category, including inactive ones — the admin must still be able to file into them. */
export async function getCategoryOptions(): Promise<CategoryOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, position, parent:parent_id(id, name)")
    .order("position", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as unknown as {
    id: string;
    name: string;
    parent: Embedded<{ id: string; name: string }>;
  }[];

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    parentName: one(row.parent)?.name ?? null,
  }));
}
