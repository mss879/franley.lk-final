/**
 * The delivery charge, exactly as public.calc_shipping_cents computes it in
 * 0006_rpc_checkout.sql. Pure so the bag, cart and checkout (client
 * components) can show the same number the database will charge.
 */
export function shippingFor(
  subtotalCents: number,
  rule: { flatRateCents: number; freeThresholdCents: number },
) {
  if (subtotalCents <= 0) return 0;
  if (subtotalCents >= rule.freeThresholdCents) return 0;
  return rule.flatRateCents;
}

/** wa.me wants the number as bare digits. */
export const waLink = (whatsapp: string, text?: string) =>
  `https://wa.me/${whatsapp.replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
