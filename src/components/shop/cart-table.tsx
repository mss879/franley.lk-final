"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, X } from "lucide-react";
import { useCart } from "@/lib/cart/cart-context";
import { ButtonLink } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";
import { FLAT_SHIPPING_CENTS, FREE_SHIPPING_THRESHOLD_CENTS } from "@/lib/constants";

export function CartTable() {
  const { lines, setQty, remove, subtotalCents, ready } = useCart();

  if (!ready) {
    return <div className="py-24 text-center text-sm text-ink-600">Loading your bag…</div>;
  }

  if (!lines.length) {
    return (
      <div className="rounded-3xl border border-dashed border-cream-300 py-24 text-center">
        <p className="font-display text-3xl">Your bag is empty</p>
        <p className="mt-3 text-sm text-ink-600">Every good outfit starts with the right knot.</p>
        <ButtonLink href="/shop" size="lg" className="mt-7">Browse the collection</ButtonLink>
      </div>
    );
  }

  const shipping = subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : FLAT_SHIPPING_CENTS;

  return (
    <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr] lg:gap-16">
      <ul className="divide-y divide-cream-300 border-y border-cream-300">
        {lines.map((line) => (
          <li key={line.productId} className="flex gap-5 py-6">
            <Link href={`/products/${line.slug}`} className="relative h-32 w-24 shrink-0 overflow-hidden rounded-xl border border-cream-300 bg-white">
              {line.image && <Image src={line.image} alt={line.title} fill sizes="96px" className="object-contain p-2" />}
            </Link>

            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link href={`/products/${line.slug}`} className="font-display text-lg hover:text-wine-700">
                    {line.title}
                  </Link>
                  {line.colorName && <p className="mt-1 text-xs text-ink-600">{line.colorName}</p>}
                  <p className="mt-1 text-sm tabular-nums text-ink-600">{formatPrice(line.priceCents)} each</p>
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

              <div className="mt-auto flex items-center justify-between pt-4">
                <div className="flex items-center rounded-full border border-cream-300">
                  <button
                    type="button"
                    onClick={() => setQty(line.productId, line.quantity - 1)}
                    aria-label={`Decrease quantity of ${line.title}`}
                    className="grid h-9 w-9 place-items-center rounded-full hover:text-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    <Minus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                  </button>
                  <span className="w-8 text-center text-sm tabular-nums">{line.quantity}</span>
                  <button
                    type="button"
                    disabled={line.quantity >= line.maxQuantity}
                    onClick={() => setQty(line.productId, line.quantity + 1)}
                    aria-label={`Increase quantity of ${line.title}`}
                    className="grid h-9 w-9 place-items-center rounded-full hover:text-wine-700 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                  </button>
                </div>
                <span className="font-display text-lg tabular-nums">
                  {formatPrice(line.priceCents * line.quantity)}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <aside className="h-fit rounded-3xl border border-cream-300 bg-cream-100 p-7 lg:sticky lg:top-28">
        <h2 className="font-display text-2xl">Order summary</h2>
        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-600">Subtotal</dt>
            <dd className="tabular-nums">{formatPrice(subtotalCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-600">Delivery</dt>
            <dd className="tabular-nums">{shipping === 0 ? "Free" : formatPrice(shipping)}</dd>
          </div>
          <div className="flex justify-between border-t border-cream-300 pt-4">
            <dt className="font-display text-lg">Total</dt>
            <dd className="font-display text-lg tabular-nums">{formatPrice(subtotalCents + shipping)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-ink-600">
          Final total is confirmed on the checkout page against live prices.
        </p>
        <ButtonLink href="/checkout" size="lg" className="mt-6 w-full">Proceed to checkout</ButtonLink>
        <Link href="/shop" className="mt-4 block text-center text-xs text-ink-600 underline underline-offset-4 hover:text-wine-700">
          Continue shopping
        </Link>
      </aside>
    </div>
  );
}
