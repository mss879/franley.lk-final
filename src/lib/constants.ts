export const SITE = {
  name: "Franley",
  tagline: "The Art of Modern Man",
  description:
    "FRANLEY is a Sri Lankan men's accessories brand built for the modern gentleman — neckties, cufflinks and finishing pieces, chosen for fabric feel, craftsmanship and presentation.",
  url: "https://franley.lk",
  currency: "LKR",
  phone: "+94 70 750 7722",
  phoneLocal: "070 750 7722",
  whatsapp: "+94707507722",
  email: "support@franley.lk",
  address: {
    line1: "10, Atapattu Road",
    city: "Dehiwala",
    country: "Sri Lanka",
  },
  hours: {
    weekdays: "Monday – Saturday, 9.00 AM – 6.00 PM",
    weekend: "Sunday & public holidays — closed",
  },
} as const;

export const FREE_SHIPPING_THRESHOLD_CENTS = 500_000; // Rs 5,000.00
export const FLAT_SHIPPING_CENTS = 35_000; // Rs 350.00

/** From franley.lk/policies/shipping-policy. */
export const DELIVERY = {
  processing: "1–2 business days after payment is confirmed",
  colombo: "1–3 working days",
  outstation: "2–5 working days",
  returnsWindow: 7,
  damageWindow: 48,
} as const;
