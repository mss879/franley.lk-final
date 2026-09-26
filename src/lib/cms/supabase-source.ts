import "server-only";
import { createAnonClient } from "@/lib/supabase/server";

/**
 * Reads published CMS blocks for a page and folds them into a single object
 * keyed by block key, e.g. { hero: {...}, editorial: {...} }.
 */
export async function getContentBlocksLive(page: string): Promise<Record<string, unknown>> {
  // Cookie-less on purpose: see src/lib/data/supabase-source.ts. Published
  // blocks are public, and reading cookies here (the shop layout calls this for
  // the announcement bar) made every storefront page dynamic.
  const supabase = createAnonClient();
  const { data, error } = await supabase
    .from("content_blocks")
    .select("key, payload")
    .eq("page", page)
    .eq("published", true);

  if (error) throw error;

  const out: Record<string, unknown> = {};
  for (const row of data ?? []) out[row.key as string] = row.payload;
  return out;
}
