import type { ListingParams } from "@/lib/seo";
import type { ProductQuery } from "@/types/domain";

/**
 * Listing-page query parameters, made safe to use.
 *
 * Next hands a page every query key as `string | string[]`, so
 * `?color=Navy&color=Black` arrives as an array — and the listing helpers,
 * which call `.split()` and `.trim()`, would throw on it. `?sort=` is
 * whatever someone typed. Pages normalise and validate here first.
 */

/** What a page's `searchParams` really holds. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * Collapse repeats onto the single-string shape `ListingParams` promises.
 * Repeated colours join into the comma list the filter bar itself writes
 * (`?color=Navy,Black`); `sort` and `q` keep their first value.
 */
export function listingParams(raw: RawSearchParams): ListingParams {
  return {
    sort: first(raw.sort),
    color: Array.isArray(raw.color) ? raw.color.join(",") : raw.color,
    q: first(raw.q),
  };
}

type Sort = NonNullable<ProductQuery["sort"]>;
export type SortOption = { value: Sort; label: string };

/** The orders /shop and category pages offer. Mirrors components/shop/shop-filters.tsx. */
export const SHOP_SORTS: SortOption[] = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price, low to high" },
  { value: "price-desc", label: "Price, high to low" },
  { value: "name-asc", label: "Alphabetical" },
];

/** A curated collection opens on the admin's hand-set order. */
export const COLLECTION_SORTS: SortOption[] = [{ value: "curated", label: "Curated" }, ...SHOP_SORTS];

export const DEFAULT_COLLECTION_SORT = COLLECTION_SORTS[0].value;

/** An unknown or missing value falls back to the list's first (default) order. */
function pick(options: SortOption[], value: string | undefined): Sort {
  return options.find((option) => option.value === value)?.value ?? options[0].value;
}

export const shopSort = (value: string | undefined) => pick(SHOP_SORTS, value);
export const collectionSort = (value: string | undefined) => pick(COLLECTION_SORTS, value);
