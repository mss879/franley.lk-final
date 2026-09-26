/**
 * Slugs that can never be served at /collections/<slug>. The `redirects()`
 * list in next.config.ts sends these paths elsewhere before routing runs, so
 * a category or collection given one would be unreachable:
 *
 *   /collections/necktie   → /collections/neckties   (the old Shopify handle)
 *   /collections/all       → /shop
 *   /collections/frontpage → /                       (Shopify's home-page collection)
 *
 * Keep this list in step with the /collections/* entries in next.config.ts.
 */
export const RESERVED_COLLECTION_SLUGS = ["all", "necktie", "frontpage"] as const;

export function isReservedCollectionSlug(slug: string): boolean {
  return (RESERVED_COLLECTION_SLUGS as readonly string[]).includes(slug);
}

export const RESERVED_SLUG_MESSAGE =
  `That slug is reserved: the site redirects ${RESERVED_COLLECTION_SLUGS.map((s) => `/collections/${s}`).join(" and ")} ` +
  "elsewhere, so a page there could never be reached. Pick another.";
