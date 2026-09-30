"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Category } from "@/types/domain";

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price, low to high" },
  { value: "price-desc", label: "Price, high to low" },
  { value: "name-asc", label: "Alphabetical" },
];

export function ShopFilters({
  categories,
  activeCategory,
  colors,
  activeColors,
  total,
}: {
  categories: Category[];
  activeCategory?: string;
  colors: string[];
  activeColors: string[];
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

  return (
    <div className="flex flex-col gap-6 border-b border-cream-300 pb-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/shop"
          className={cn(
            "rounded-full border px-4 py-2 text-xs transition-colors duration-300",
            !activeCategory
              ? "border-ink-900 bg-ink-900 text-cream-50"
              : "border-cream-300 text-ink-600 hover:border-wine-700 hover:text-wine-700",
          )}
        >
          All
        </Link>
        {categories
          .filter((c) => c.slug !== "neckties")
          .map((c) => (
            <Link
              key={c.slug}
              href={`/collections/${c.slug}`}
              className={cn(
                "rounded-full border px-4 py-2 text-xs transition-colors duration-300",
                activeCategory === c.slug
                  ? "border-ink-900 bg-ink-900 text-cream-50"
                  : "border-cream-300 text-ink-600 hover:border-wine-700 hover:text-wine-700",
              )}
            >
              {c.name}
            </Link>
          ))}
      </div>

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
                    ? "border-ink-900 bg-ink-900/5 text-ink-900"
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
            value={params.get("sort") ?? "newest"}
            onChange={(e) => setParam("sort", e.target.value === "newest" ? null : e.target.value)}
            className="rounded-full border border-cream-300 bg-transparent px-4 py-2 text-xs text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
