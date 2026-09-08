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
  colorName: string | null;
  quantity: number;
  /** Stock at the time the line was added, for optimistic UI limits. */
  maxQuantity: number;
};

export type CartState = { lines: CartLine[] };
