"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { inputClass } from "./fields";
import { PRODUCT_STATUSES, STATUS_LABEL, type CategoryOption } from "./shared";

export function ProductFilters({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const q = params.get("q") ?? "";
  const [search, setSearch] = useState(q);
  // Reset the box when the URL changes underneath it (back button, Clear).
  const [syncedQ, setSyncedQ] = useState(q);
  if (syncedQ !== q) {
    setSyncedQ(q);
    setSearch(q);
  }

  const push = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value == null || value === "") next.delete(key);
      else next.set(key, value);
    }
    // Any change to the filter set invalidates the current page number.
    next.delete("page");
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const hasFilters = Boolean(q || params.get("status") || params.get("category"));

  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-cream-300 bg-white p-4 sm:flex-row sm:items-end">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          push({ q: search.trim() || null });
        }}
        className="min-w-0 flex-1"
      >
        <label htmlFor="product-search" className="mb-1.5 block text-xs font-medium text-ink-600">
          Search
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
            strokeWidth={1.5}
            aria-hidden
          />
          <input
            id="product-search"
            type="search"
            name="q"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title"
            className={cn(inputClass, "border-cream-300 pl-10")}
          />
        </div>
      </form>

      <div className="w-full sm:w-48">
        <label htmlFor="filter-category" className="mb-1.5 block text-xs font-medium text-ink-600">
          Category
        </label>
        <select
          id="filter-category"
          value={params.get("category") ?? ""}
          onChange={(e) => push({ category: e.target.value || null })}
          className={cn(inputClass, "appearance-none")}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.parentName ? `${c.parentName} › ${c.name}` : c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="w-full sm:w-40">
        <label htmlFor="filter-status" className="mb-1.5 block text-xs font-medium text-ink-600">
          Status
        </label>
        <select
          id="filter-status"
          value={params.get("status") ?? ""}
          onChange={(e) => push({ status: e.target.value || null })}
          className={cn(inputClass, "appearance-none")}
        >
          <option value="">All statuses</option>
          {PRODUCT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      {hasFilters && (
        <button
          type="button"
          onClick={() => push({ q: null, status: null, category: null })}
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-cream-300 px-4 text-xs text-ink-600 transition-colors hover:border-wine-700 hover:text-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
          Clear
        </button>
      )}
    </div>
  );
}
