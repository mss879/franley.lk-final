import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Reads published CMS blocks for a page and folds them into a single object
 * keyed by block key, e.g. { hero: {...}, editorial: {...} }.
 */
export async function getContentBlocksLive(page: string): Promise<Record<string, unknown>> {
  const supabase = await createClient();
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
