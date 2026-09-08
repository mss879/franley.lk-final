import type { Product } from "@/types/domain";
import { clamp, copyPrice } from "./config";

/**
 * The catalogue reuses one marketing paragraph across every tie and another
 * across every cufflink set, which would give 49 products the same meta
 * description. These build a distinct one per product out of the attributes
 * that actually differ — title, colour, weave, blade width, price.
 */

/** The blade width is the one spec buyers compare, so it earns its place in the title. */
export function productSeoTitle(product: Product) {
  return product.widthCm ? `${product.title} — ${product.widthCm} cm Blade` : product.title;
}

export function productSeoDescription(product: Product) {
  const price = copyPrice(product.priceCents);
  const tail = `${price}, delivered island-wide in Sri Lanka.`;
  const colour = product.colorName?.toLowerCase();
  const blade = product.widthCm ? `, cut to a ${product.widthCm} cm blade` : "";

  if (product.categorySlug === "cufflinks") {
    return clamp(
      `${product.title} — premium silver-tone alloy with a matching tie clip, gift boxed. ${tail}`,
    );
  }

  if (colour) {
    const weave = product.title.includes("Two-Tone")
      ? `a two-tone weave on a ${colour} ground`
      : product.categorySlug === "striped-ties"
        ? `diagonal repp stripes on a ${colour} ground`
        : `a solid ${colour} necktie woven in a fine silk-finish twill`;
    return clamp(`${product.title} — ${weave}${blade}. ${tail}`);
  }

  return clamp(`${product.title} — ${product.description} ${tail}`);
}
