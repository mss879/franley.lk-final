/**
 * A cart line holds a *snapshot* for display only. The server re-reads the
 * real price from the database at checkout — never trust these numbers for
 * money. See the checkout RPC.
 */
export type CartLine = {
  productId: string;
  slug: string;
  title: string;
  /** Display snapshot in integer cents. Re-validated server-side. */
  priceCents: number;
  image: string | null;
  /** The colour chosen, for a product sold in several (product_colors.id). */
  colorId?: string | null;
  colorName: string | null;
  quantity: number;
  /** Stock at the time the line was added, for optimistic UI limits. */
  maxQuantity: number;
};

export type CartState = { lines: CartLine[] };

/** Identifies a line: two colours of one tie are two lines. */
export function lineKey(line: Pick<CartLine, "productId" | "colorId">) {
  return line.colorId ? `${line.productId}:${line.colorId}` : line.productId;
}
