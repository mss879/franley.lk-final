"use client";

import { createContext, useContext, useState } from "react";
import { cn } from "@/lib/utils";
import { ProductGallery } from "@/components/shop/product-gallery";
import type { ProductColor } from "@/types/domain";

/**
 * The colour a shopper has picked on a product page. The gallery, the
 * availability line and Add to bag sit in different columns of the page, so
 * they share the choice through this context. Nothing is picked at first: the
 * page opens on the general photographs (the whole range together), and a
 * colour's own photographs replace them once it is chosen.
 */
type ColourState = {
  colors: ProductColor[];
  selected: ProductColor | null;
  select: (id: string) => void;
};

const ColourContext = createContext<ColourState | null>(null);

export function ProductColourProvider({ colors, children }: { colors: ProductColor[]; children: React.ReactNode }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = colors.find((c) => c.id === selectedId) ?? null;
  return (
    <ColourContext.Provider value={{ colors, selected, select: setSelectedId }}>
      {children}
    </ColourContext.Provider>
  );
}

/** Null on a product page without colours (or outside one). */
export function useProductColour() {
  const ctx = useContext(ColourContext);
  return ctx && ctx.colors.length ? ctx : null;
}

export function ColourGallery({ images, title }: { images: string[]; title: string }) {
  const colour = useProductColour();
  const shots = colour?.selected?.images.length ? colour.selected.images : images;
  // Keyed so the gallery starts on the first photograph of each colour.
  return <ProductGallery key={colour?.selected?.id ?? "all"} images={shots} title={title} />;
}

export function ColourPicker() {
  const colour = useProductColour();
  if (!colour) return null;
  const { colors, selected, select } = colour;

  return (
    <fieldset className="mt-8">
      <legend className="eyebrow text-ink-600">
        Colour{selected ? <span className="ml-2 normal-case tracking-normal text-ink-900">{selected.name}</span> : null}
      </legend>
      <div className="mt-3 flex flex-wrap gap-2">
        {colors.map((c) => {
          const soldOut = c.stock <= 0;
          const active = selected?.id === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => select(c.id)}
              aria-pressed={active}
              className={cn(
                "rounded-full border px-4 py-2 text-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                active ? "border-ink-900 bg-ink-900 text-cream-50" : "border-cream-300 hover:border-ink-400",
                soldOut && !active && "text-ink-600 line-through decoration-ink-400",
              )}
            >
              {c.name}
              {soldOut && <span className="sr-only"> (sold out)</span>}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function ColourAvailability({ stock }: { stock: number }) {
  const colour = useProductColour();
  const n = colour?.selected ? colour.selected.stock : stock;
  return <>{n <= 0 ? "Sold out" : n <= 5 ? `Only ${n} left` : "In stock"}</>;
}
