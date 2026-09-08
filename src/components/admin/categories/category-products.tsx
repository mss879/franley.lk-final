"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ChevronDown, Loader2, PackageOpen } from "lucide-react";
import { moveProductToCategory } from "@/app/admin/(guarded)/categories/actions";
import type { CategoryProduct } from "@/app/admin/(guarded)/categories/data";
import { cn, formatPrice } from "@/lib/utils";

const STATUS_STYLE: Record<CategoryProduct["status"], string> = {
  active: "border-wine-700/25 bg-wine-700/8 text-wine-800",
  draft: "border-cream-300 bg-cream-100 text-ink-600",
  archived: "border-cream-300 bg-cream-100 text-ink-400",
};

export function CategoryProducts({
  categoryName,
  products,
  destinations,
}: {
  categoryName: string;
  products: CategoryProduct[];
  destinations: { id: string; label: string }[];
}) {
  const [pending, start] = useTransition();
  const [movingId, setMovingId] = useState<string | null>(null);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const move = (product: CategoryProduct) => {
    const destination = choice[product.id] ?? "";
    if (!destination) {
      setMessage({ tone: "error", text: "Pick a category to move that product into." });
      return;
    }
    const label = destinations.find((d) => d.id === destination)?.label ?? "the new category";

    setMovingId(product.id);
    start(async () => {
      const result = await moveProductToCategory(product.id, destination);
      setMovingId(null);
      setMessage(
        result.ok
          ? { tone: "ok", text: `“${product.title}” moved to ${label}.` }
          : { tone: "error", text: result.message },
      );
    });
  };

  if (products.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-cream-300 bg-cream-50 px-6 py-10 text-center">
        <PackageOpen className="mx-auto h-6 w-6 text-ink-400" strokeWidth={1.5} aria-hidden />
        <p className="mt-3 text-sm text-ink-800">Nothing is filed under {categoryName} yet.</p>
        <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-ink-600">
          Assign a product to this category from its own page, and it will show up here ready to be
          moved on.
        </p>
        <Link
          href="/admin/products"
          className="mt-5 inline-flex h-9 items-center rounded-full border border-ink-800/20 px-5 text-xs font-medium text-ink-800 transition-colors hover:border-wine-700 hover:text-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
        >
          Go to Products
        </Link>
      </div>
    );
  }

  return (
    <div>
      <p aria-live="polite" className="mb-3 min-h-4 text-xs leading-relaxed">
        {message && (
          <span className={message.tone === "error" ? "text-wine-700" : "text-ink-600"}>
            {message.text}
          </span>
        )}
      </p>

      <div className="overflow-hidden rounded-3xl border border-cream-300 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left">
            <caption className="sr-only">Products currently filed under {categoryName}</caption>
            <thead>
              <tr className="border-b border-cream-300 bg-cream-100/70">
                <th scope="col" className="eyebrow px-6 py-4 text-ink-600">
                  Product
                </th>
                <th scope="col" className="eyebrow px-6 py-4 text-ink-600">
                  Price
                </th>
                <th scope="col" className="eyebrow px-6 py-4 text-ink-600">
                  Move to
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-cream-300/70 last:border-b-0">
                  <th scope="row" className="px-6 py-4 font-normal">
                    <p className="text-sm text-ink-800">{product.title}</p>
                    <p className="mt-1 flex items-center gap-2 text-xs text-ink-600">
                      <span
                        className={cn(
                          "inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-medium capitalize",
                          STATUS_STYLE[product.status],
                        )}
                      >
                        {product.status}
                      </span>
                      {product.stock} in stock
                    </p>
                  </th>
                  <td className="whitespace-nowrap px-6 py-4 align-middle text-sm text-ink-800">
                    {formatPrice(product.priceCents)}
                  </td>
                  <td className="px-6 py-4 align-middle">
                    <div className="flex items-center gap-2">
                      <label htmlFor={`move-${product.id}`} className="sr-only">
                        New category for {product.title}
                      </label>
                      <div className="relative">
                        <select
                          id={`move-${product.id}`}
                          value={choice[product.id] ?? ""}
                          onChange={(e) =>
                            setChoice((prev) => ({ ...prev, [product.id]: e.target.value }))
                          }
                          className="h-9 w-48 appearance-none rounded-full border border-cream-300 bg-white pl-4 pr-9 text-xs text-ink-800 focus-visible:border-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                        >
                          <option value="">Choose a category…</option>
                          {destinations.map((destination) => (
                            <option key={destination.id} value={destination.id}>
                              {destination.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          className="pointer-events-none absolute right-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400"
                          strokeWidth={1.5}
                          aria-hidden
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => move(product)}
                        disabled={pending}
                        className="inline-flex h-9 items-center gap-2 rounded-full border border-ink-800/20 px-4 text-xs font-medium text-ink-800 transition-colors hover:border-wine-700 hover:text-wine-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
                      >
                        {pending && movingId === product.id && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        )}
                        Move
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
