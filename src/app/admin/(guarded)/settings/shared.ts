/** Shared between the settings page, its form and its server action. */

export type SettingRow = {
  key: string;
  group_key: string;
  label: string;
  help: string | null;
  value_type: "text" | "textarea" | "boolean" | "number" | "money_cents" | "url" | "email" | "phone" | "select";
  options: (string | { value?: string; label?: string })[] | null;
  value: unknown;
  default_value: unknown;
  is_public: boolean;
  is_locked: boolean;
  position: number;
};

export type SettingsState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
  /** What was typed, echoed back on a failed save so React's post-action form reset keeps it. */
  values?: Record<string, string>;
} | null;

/** The integrations group holds secrets and is never shown or saved from the app. */
export const EDITABLE_GROUPS = ["store", "contact", "shipping", "checkout", "payment", "social"] as const;

export const GROUP_COPY: Record<(typeof EDITABLE_GROUPS)[number], { title: string; description: string }> = {
  store: { title: "Store", description: "The shop's name, as it appears in the footer." },
  contact: { title: "Contact", description: "Shown in the footer, on the contact and policy pages, and on the WhatsApp buttons." },
  shipping: { title: "Delivery", description: "What checkout charges. The bag, cart and checkout show exactly these numbers." },
  checkout: { title: "Checkout", description: "Turn ordering off without taking the site down, and set per-order limits." },
  payment: { title: "Payment", description: "Bank transfer instructions, shown at checkout, on the order page and in the confirmation email." },
  social: { title: "Social", description: "Links to the shop's profiles, shown as icons in the footer. Leave empty until the account exists." },
};

/** Currency is baked into every stored amount; changing it here would corrupt prices. */
export const READ_ONLY_KEYS = ["store.currency"];

/**
 * Seeded rows nothing on the storefront reads yet — the tagline, page titles
 * and descriptions are written into the site's code and SEO setup. Offering
 * them here would promise a change that never appears. (The whole `seo` group
 * is left out of EDITABLE_GROUPS for the same reason.)
 */
export const HIDDEN_KEYS = ["store.tagline"];
