"use client";

import { useState } from "react";
import { Minus, Plus, Check } from "lucide-react";
import { useCart } from "@/lib/cart/cart-context";
import { Button } from "@/components/ui/button";
import type { Product } from "@/types/domain";

export function AddToBag({ product }: { product: Product }) {
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const soldOut = product.stock <= 0;

  const onAdd = () => {
    add({
      productId: product.id,
      slug: product.slug,
      title: product.title,
      priceCents: product.priceCents,
      image: product.images[0] ?? null,
      colorName: product.colorName,
      maxQuantity: product.stock,
      quantity: qty,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2000);
  };

  if (soldOut) {
    return (
      <div className="rounded-full border border-cream-300 bg-cream-100 px-6 py-4 text-center text-sm text-ink-600">
        Sold out — message us on WhatsApp to be notified when it returns.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="flex items-center justify-between rounded-full border border-cream-300 px-2 sm:w-36">
        <button
          type="button"
          onClick={() => setQty((q) => Math.max(1, q - 1))}
          disabled={qty <= 1}
          aria-label="Decrease quantity"
          className="grid h-12 w-12 place-items-center rounded-full transition-colors hover:text-wine-700 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <Minus className="h-4 w-4" strokeWidth={1.5} aria-hidden />
        </button>
        <span className="min-w-6 text-center text-sm tabular-nums" aria-live="polite">{qty}</span>
        <button
          type="button"
          onClick={() => setQty((q) => Math.min(product.stock, q + 1))}
          disabled={qty >= product.stock}
          aria-label="Increase quantity"
          className="grid h-12 w-12 place-items-center rounded-full transition-colors hover:text-wine-700 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden />
        </button>
      </div>

      <Button onClick={onAdd} size="lg" className="flex-1">
        {added ? (
          <>
            <Check className="h-4 w-4" strokeWidth={2} aria-hidden />
            Added to bag
          </>
        ) : (
          "Add to bag"
        )}
      </Button>
    </div>
  );
}
