import Image from "next/image";
import Link from "next/link";
import { formatPrice, cn } from "@/lib/utils";

export type ProductCardData = {
  slug: string;
  title: string;
  priceCents: number;
  compareAtCents?: number | null;
  image: string | null;
  hoverImage?: string | null;
  colorName?: string | null;
  colorHex?: string | null;
  categoryName?: string | null;
  soldOut?: boolean;
};

/**
 * Product shots are photographed on pure white, so the frame is always a light
 * surface — never burgundy, or the cut-out shows as a white box.
 */
export function ProductCard({
  product,
  className,
  priority = false,
}: {
  product: ProductCardData;
  className?: string;
  priority?: boolean;
}) {
  const onSale = product.compareAtCents != null && product.compareAtCents > product.priceCents;

  return (
    <Link
      href={`/products/${product.slug}`}
      className={cn(
        "group relative flex flex-col focus-visible:outline-none",
        "focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-4 focus-visible:ring-offset-cream-50 rounded-2xl",
        className,
      )}
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-cream-300 bg-white transition-shadow duration-500 ease-[--ease-lux] group-hover:shadow-[0_18px_40px_-24px_rgba(64,11,22,0.45)]">
        {product.image ? (
          <>
            <Image
              src={product.image}
              alt={product.title}
              fill
              priority={priority}
              sizes="(max-width: 1024px) 50vw, (max-width: 1520px) 25vw, 340px"
              className={cn(
                "object-contain p-4 transition-transform duration-700 ease-[--ease-lux]",
                product.hoverImage
                  ? "group-hover:opacity-0"
                  : "group-hover:scale-[1.04]",
              )}
            />
            {/* Only pointer devices can reveal this second shot, and only they
                should download it. `hover-only` is display:none under
                (hover: none), which stops the lazy-loading observer from ever
                firing on a phone — 44 of 49 products carry a second image, so
                this was doubling image weight on mobile listing pages. */}
            {product.hoverImage && (
              <Image
                src={product.hoverImage}
                alt=""
                fill
                sizes="(max-width: 1024px) 50vw, (max-width: 1520px) 25vw, 340px"
                className="hover-only object-contain p-4 opacity-0 transition-opacity duration-500 ease-[--ease-lux] group-hover:opacity-100"
              />
            )}
          </>
        ) : (
          <div className="grid h-full place-items-center text-xs text-ink-600">No image</div>
        )}

        {onSale && (
          <span className="absolute left-3 top-3 rounded-full bg-wine-700 px-3 py-1 text-[10px] font-medium tracking-wider text-cream-50 uppercase">
            Sale
          </span>
        )}
        {product.soldOut && (
          <span className="absolute inset-x-0 bottom-0 bg-ink-900/80 py-2 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-cream-50">
            Sold out
          </span>
        )}
      </div>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {product.categoryName && (
            <p className="eyebrow text-ink-600">{product.categoryName}</p>
          )}
          <h3 className="font-display mt-1 text-base leading-snug text-ink-900 transition-colors duration-300 group-hover:text-wine-700">
            {product.title}
          </h3>
        </div>
        {product.colorHex && (
          <span
            aria-hidden
            title={product.colorName ?? undefined}
            className="mt-1 h-4 w-4 shrink-0 rounded-full border border-ink-900/12"
            style={{ backgroundColor: product.colorHex }}
          />
        )}
      </div>

      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-sm tabular-nums text-ink-800">{formatPrice(product.priceCents)}</span>
        {onSale && (
          <span className="text-xs tabular-nums text-ink-600 line-through">
            {formatPrice(product.compareAtCents!)}
          </span>
        )}
      </div>
    </Link>
  );
}
