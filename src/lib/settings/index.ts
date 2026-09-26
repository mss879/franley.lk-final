import "server-only";
import { cache } from "react";
import { isLive } from "@/lib/data";
import { createAnonClient } from "@/lib/supabase/server";
import { FLAT_SHIPPING_CENTS, FREE_SHIPPING_THRESHOLD_CENTS, SITE } from "@/lib/constants";

/**
 * The values the owner edits at /admin/settings, as the storefront reads them.
 *
 * public.site_settings is the source of truth — place_order charges delivery
 * from it — so the storefront reads the same rows rather than a TypeScript
 * constant that could drift. src/lib/constants.ts stays as the fallback for
 * seed mode, an unreachable database, or a row that was never seeded.
 */
export type SiteSettings = {
  storeName: string;
  tagline: string;
  phone: string;
  whatsapp: string;
  email: string;
  flatRateCents: number;
  freeThresholdCents: number;
  checkoutEnabled: boolean;
  /** Null until the owner fills in real account details — see placeholderBank. */
  bankTransferDetails: string | null;
  instagram: string | null;
  facebook: string | null;
};

export const DEFAULT_SETTINGS: SiteSettings = {
  storeName: SITE.name,
  tagline: SITE.tagline,
  phone: SITE.phone,
  whatsapp: SITE.whatsapp,
  email: SITE.email,
  flatRateCents: FLAT_SHIPPING_CENTS,
  freeThresholdCents: FREE_SHIPPING_THRESHOLD_CENTS,
  checkoutEnabled: true,
  bankTransferDetails: null,
  instagram: null,
  facebook: null,
};

/** 0009 seeds "Bank: —\nAccount name: —…". Showing that to a shopper is worse than showing nothing. */
const placeholderBank = (v: string) => /—\s*(\n|$)/.test(v) || !v.trim();

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
/** Read the way calc_shipping_cents reads it: a JSON number, or digits typed as a string in the table editor. */
const cents = (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN;
  return Number.isInteger(n) && n >= 0 ? n : null;
};

/**
 * Once per request (React cache), through a cookie-less client so a page that
 * reads settings can still be statically rendered. ISR pages hold the result
 * for their revalidate window; the settings screen revalidates the storefront
 * on save.
 */
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  if (!isLive()) return DEFAULT_SETTINGS;

  try {
    const { data, error } = await createAnonClient().from("site_settings").select("key, value");
    if (error || !data) return DEFAULT_SETTINGS;

    const v = Object.fromEntries(data.map((r) => [r.key as string, r.value as unknown]));
    const bank = text(v["payment.bank_transfer_details"]);

    return {
      storeName: text(v["store.name"]) ?? DEFAULT_SETTINGS.storeName,
      tagline: text(v["store.tagline"]) ?? DEFAULT_SETTINGS.tagline,
      phone: text(v["contact.phone"]) ?? DEFAULT_SETTINGS.phone,
      whatsapp: text(v["contact.whatsapp"]) ?? DEFAULT_SETTINGS.whatsapp,
      email: text(v["contact.email"]) ?? DEFAULT_SETTINGS.email,
      flatRateCents: cents(v["shipping.flat_rate_cents"]) ?? DEFAULT_SETTINGS.flatRateCents,
      freeThresholdCents: cents(v["shipping.free_threshold_cents"]) ?? DEFAULT_SETTINGS.freeThresholdCents,
      // Only an explicit false closes checkout; place_order enforces the same.
      checkoutEnabled: v["checkout.enabled"] !== false && v["checkout.enabled"] !== "false",
      bankTransferDetails: bank && !placeholderBank(bank) ? bank : null,
      instagram: text(v["social.instagram"]),
      facebook: text(v["social.facebook"]),
    };
  } catch {
    // A settings outage must not take the storefront down with it.
    return DEFAULT_SETTINGS;
  }
});

/** The subset client components need — nothing here is secret, but keep it small. */
export type PublicSettings = Pick<
  SiteSettings,
  "storeName" | "phone" | "whatsapp" | "email" | "flatRateCents" | "freeThresholdCents" | "bankTransferDetails"
>;

export function publicSettings(s: SiteSettings): PublicSettings {
  return {
    storeName: s.storeName,
    phone: s.phone,
    whatsapp: s.whatsapp,
    email: s.email,
    flatRateCents: s.flatRateCents,
    freeThresholdCents: s.freeThresholdCents,
    bankTransferDetails: s.bankTransferDetails,
  };
}
