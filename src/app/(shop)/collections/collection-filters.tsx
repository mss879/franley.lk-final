"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { COLLECTION_SORTS, DEFAULT_COLLECTION_SORT } from "@/lib/listing-params";
import { cn } from "@/lib/utils";
import type { Category, ProductQuery } from "@/types/domain";

/**
 * The filter bar for a curated collection. Same shape as the shop's
 * ShopFilters, but the sort opens on the admin's hand-set order, and no
 * category pill is lit — a collection cuts across them.
 */
export function CollectionFilters({
  categories,
  colors,
  activeColors,
  activeSort,
  total,
}: {
  categories: Category[];
  colors: string[];
  activeColors: string[];
  /** The order actually applied, already validated — `?sort=` may hold junk. */
  activeSort: NonNullable<ProductQuery["sort"]>;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const toggleColor = (color: string) => {
    const next = activeColors.includes(color)
      ? activeColors.filter((c) => c !== color)
      : [...activeColors, color];
    setParam("color", next.length ? next.join(",") : null);
  };

  const pill =
    "rounded-full border border-cream-300 px-4 py-2 text-xs text-ink-600 transition-colors duration-300 hover:border-wine-700 hover:text-wine-700 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2";

  return (
    <div className="flex flex-col gap-6 border-b border-cream-300 pb-6">
      <nav aria-label="Browse elsewhere" className="flex flex-wrap items-center gap-2">
        <span className="eyebrow mr-1 text-ink-600">Browse</span>
        <Link href="/shop" className={pill}>
          All products
        </Link>
        {categories
          .filter((c) => c.slug !== "neckties")
          .map((c) => (
            <Link key={c.slug} href={`/collections/${c.slug}`} className={pill}>
              {c.name}
            </Link>
          ))}
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow mr-1 text-ink-600">Colour</span>
          {colors.map((color) => {
            const on = activeColors.includes(color);
            return (
              <button
                key={color}
                type="button"
                aria-pressed={on}
                onClick={() => toggleColor(color)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs transition-colors duration-300",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2",
                  on
                    ? "border-wine-700 bg-wine-700/10 text-wine-700"
                    : "border-cream-300 text-ink-600 hover:border-ink-400",
                )}
              >
                {color}
              </button>
            );
          })}
          {activeColors.length > 0 && (
            <button
              type="button"
              onClick={() => setParam("color", null)}
              className="ml-1 text-xs text-ink-600 underline underline-offset-4 hover:text-wine-700"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-600" aria-live="polite">
            {total} {total === 1 ? "piece" : "pieces"}
          </span>
          <label className="sr-only" htmlFor="sort">Sort by</label>
          <select
            id="sort"
            value={activeSort}
            onChange={(e) =>
              setParam("sort", e.target.value === DEFAULT_COLLECTION_SORT ? null : e.target.value)
            }
            className="rounded-full border border-cream-300 bg-transparent px-4 py-2 text-xs text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            {COLLECTION_SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
