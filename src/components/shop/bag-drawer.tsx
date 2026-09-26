"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, X, ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart/cart-context";
import { ButtonLink } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";
import { useSiteSettings } from "@/lib/settings/provider";
import { useFocusTrap } from "@/lib/a11y/use-focus-trap";

export function BagDrawer() {
  const { lines, isOpen, closeBag, setQty, remove, subtotalCents, count } = useCart();
  const { freeThresholdCents } = useSiteSettings();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Escape, the Tab cycle, initial focus and focus restoration all live in the
  // hook — Tab used to walk out of the drawer into the page behind the backdrop.
  useFocusTrap({ active: isOpen, containerRef: panelRef, onClose: closeBag, initialFocusRef: closeRef });

  // Lock the page behind the drawer.
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const remaining = freeThresholdCents - subtotalCents;
  const pct = freeThresholdCents > 0 ? Math.min(100, (subtotalCents / freeThresholdCents) * 100) : 100;

  return (
    <div hidden={!isOpen} className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Shopping bag">
      <button
        type="button"
        aria-label="Close bag"
        tabIndex={-1}
        onClick={closeBag}
        className="absolute inset-0 cursor-default bg-ink-900/45 backdrop-blur-[2px]"
      />

      <div
        ref={panelRef}
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-cream-50 shadow-2xl"
        style={{ animation: isOpen ? "fade-up 0.4s var(--ease-lux) both" : undefined }}
      >
        <div className="flex items-center justify-between border-b border-cream-300 px-6 py-5">
          <h2 className="font-display text-xl">
            Your Bag
            {count > 0 && <span className="ml-2 text-sm text-ink-600">({count})</span>}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={closeBag}
            aria-label="Close bag"
            className="grid h-10 w-10 place-items-center rounded-full border border-ink-900/12 transition-colors hover:border-wine-700 hover:text-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
          >
            <X className="h-4 w-4" strokeWidth={1.5} aria-hidden />
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-cream-200 text-wine-700">
              <ShoppingBag className="h-6 w-6" strokeWidth={1.25} aria-hidden />
            </span>
            <p className="font-display text-2xl">Your bag is empty</p>
            <p className="text-sm text-ink-600">Every good outfit starts with the right knot.</p>
            <ButtonLink href="/shop" onClick={closeBag} className="mt-2">
              Browse the collection
            </ButtonLink>
          </div>
        ) : (
          <>
            <div className="border-b border-cream-300 px-6 py-4">
              {remaining > 0 ? (
                <p className="text-xs text-ink-600">
                  You&rsquo;re <strong className="text-wine-700">{formatPrice(remaining)}</strong> away from free islandwide delivery.
                </p>
              ) : (
                <p className="text-xs text-wine-700">Free islandwide delivery unlocked.</p>
              )}
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-cream-300">
                <div className="h-full rounded-full bg-wine-700 transition-[width] duration-500 ease-[--ease-lux]" style={{ width: `${pct}%` }} />
              </div>
            </div>

            <ul className="flex-1 divide-y divide-cream-300 overflow-y-auto px-6">
              {lines.map((line) => (
                <li key={line.productId} className="flex gap-4 py-5">
                  <Link href={`/products/${line.slug}`} onClick={closeBag} className="relative h-24 w-20 shrink-0 overflow-hidden rounded-lg bg-white">
                    {line.image && (
                      <Image src={line.image} alt={line.title} fill sizes="80px" className="object-contain p-1" />
                    )}
                  </Link>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/products/${line.slug}`} onClick={closeBag} className="font-display block truncate text-base hover:text-wine-700">
                          {line.title}
                        </Link>
                        {line.colorName && <p className="mt-0.5 text-xs text-ink-600">{line.colorName}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(line.productId)}
                        aria-label={`Remove ${line.title}`}
                        className="shrink-0 text-ink-400 transition-colors hover:text-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                      >
                        <X className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                      </button>
                    </div>

                    <div className="mt-auto flex items-center justify-between pt-3">
                      <div className="flex items-center rounded-full border border-cream-300">
                        <button
                          type="button"
                          onClick={() => setQty(line.productId, line.quantity - 1)}
                          aria-label={`Decrease quantity of ${line.title}`}
                          className="grid h-8 w-8 place-items-center rounded-full transition-colors hover:text-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                        >
                          <Minus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                        </button>
                        <span className="w-7 text-center text-sm tabular-nums" aria-live="polite">{line.quantity}</span>
                        <button
                          type="button"
                          disabled={line.quantity >= line.maxQuantity}
                          onClick={() => setQty(line.productId, line.quantity + 1)}
                          aria-label={`Increase quantity of ${line.title}`}
                          className="grid h-8 w-8 place-items-center rounded-full transition-colors hover:text-wine-700 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                        >
                          <Plus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                        </button>
                      </div>
                      <span className="font-display text-base tabular-nums">
                        {formatPrice(line.priceCents * line.quantity)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-cream-300 bg-cream-100 px-6 py-5">
              <div className="flex items-baseline justify-between">
                <span className="eyebrow text-ink-600">Subtotal</span>
                <span className="font-display text-2xl tabular-nums">{formatPrice(subtotalCents)}</span>
              </div>
              <p className="mt-1 text-xs text-ink-600">Delivery calculated at checkout.</p>
              <ButtonLink href="/checkout" onClick={closeBag} size="lg" className="mt-4 w-full">
                Checkout
              </ButtonLink>
              <button
                type="button"
                onClick={closeBag}
                className="mt-3 w-full text-center text-xs text-ink-600 underline underline-offset-4 transition-colors hover:text-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                Continue shopping
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
