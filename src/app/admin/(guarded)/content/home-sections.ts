import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_HOME,
  HOME_PRODUCT_SECTIONS,
  type ProductSectionKey,
} from "@/lib/cms/defaults";
import type { CollectionOption } from "@/components/admin/content/types";
import { listCollections } from "../collections/data";

/**
 * The admin's view of the home page's product sections (0020_home_sections.sql):
 * which collection each one reads, and whether it is on the page. Shared by
 * the Home page & Banners list, the block editor, and the Collections screens,
 * so all three tell the owner the same thing.
 */

export async function listCollectionOptions(): Promise<CollectionOption[]> {
  try {
    const rows = await listCollections();
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      isActive: r.isActive,
      liveCount: r.liveCount,
    }));
  } catch {
    return [];
  }
}

export type HomeSectionUsage = {
  key: ProductSectionKey;
  /** "Featured", "New in", "Trending". */
  name: string;
  /** What the section shows when its collection has nothing live. */
  fallback: string;
  /** The content block holding its heading; null until 0020 has run (Trending). */
  blockId: string | null;
  /** Whether the section is on the home page at all. */
  shown: boolean;
  /** The collection slug it reads, after the same default rule the storefront applies. */
  slug: string;
  /** That collection, or null if no collection has the slug. */
  collection: CollectionOption | null;
};

export async function getHomeSections(
  collections?: CollectionOption[],
): Promise<HomeSectionUsage[]> {
  const supabase = await createClient();
  const [{ data }, options] = await Promise.all([
    supabase
      .from("content_blocks")
      .select("id, key, payload, published")
      .eq("page", "home")
      .in(
        "key",
        HOME_PRODUCT_SECTIONS.map((s) => s.key),
      ),
    collections ? Promise.resolve(collections) : listCollectionOptions(),
  ]);

  const rows = (data ?? []) as { id: string; key: string; payload: unknown; published: boolean }[];

  return HOME_PRODUCT_SECTIONS.map((section) => {
    const row = rows.find((r) => r.key === section.key) ?? null;
    const payload =
      row?.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
        ? (row.payload as Record<string, unknown>)
        : {};
    // Same as the storefront's deep-merge: an empty value means the default.
    const saved = typeof payload.collection === "string" ? payload.collection.trim() : "";
    const slug = saved || DEFAULT_HOME[section.key].collection;

    return {
      key: section.key,
      name: section.name,
      fallback: section.fallback,
      blockId: row?.id ?? null,
      // An unpublished section is left off the home page (getHomeContent).
      shown: Boolean(row?.published),
      slug,
      collection: options.find((c) => c.slug === slug) ?? null,
    };
  });
}
