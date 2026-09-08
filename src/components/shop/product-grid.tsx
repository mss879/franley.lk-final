import { ProductCard } from "./product-card";
import type { Product } from "@/types/domain";

export function ProductGrid({ products, priorityCount = 4 }: { products: Product[]; priorityCount?: number }) {
  if (!products.length) {
    return (
      <div className="rounded-3xl border border-dashed border-cream-300 py-24 text-center">
        <p className="font-display text-2xl">Nothing here yet</p>
        <p className="mt-2 text-sm text-ink-600">Try clearing a filter, or browse the full range.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-12 lg:grid-cols-4">
      {products.map((p, i) => (
        <ProductCard
          key={p.id}
          priority={i < priorityCount}
          product={{
            slug: p.slug,
            title: p.title,
            priceCents: p.priceCents,
            compareAtCents: p.compareAtCents,
            image: p.images[0] ?? null,
            hoverImage: p.images[1] ?? null,
            colorName: p.colorName,
            colorHex: p.colorHex,
            categoryName: p.categoryName,
            soldOut: p.stock <= 0,
          }}
        />
      ))}
    </div>
  );
}
