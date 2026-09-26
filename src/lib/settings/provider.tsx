"use client";

import { createContext, useContext } from "react";
import type { PublicSettings } from "./index";

const Ctx = createContext<PublicSettings | null>(null);

/** Hands the admin-editable settings to the bag, cart, checkout and WhatsApp button. */
export function SiteSettingsProvider({ value, children }: { value: PublicSettings; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSiteSettings(): PublicSettings {
  const value = useContext(Ctx);
  if (!value) throw new Error("useSiteSettings must be used inside <SiteSettingsProvider> (the shop layout).");
  return value;
}
