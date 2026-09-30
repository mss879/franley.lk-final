"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { WhatsAppIcon } from "@/components/ui/social-icons";
import { useSiteSettings } from "@/lib/settings/provider";
import { waLink } from "@/lib/settings/shipping";
import { cn } from "@/lib/utils";

/**
 * Franley's support promise is "fast WhatsApp support", so it gets a persistent
 * affordance. Hidden on checkout — nothing should compete with placing the
 * order — and it only appears once the shopper has scrolled past the hero.
 */
export function WhatsAppFloat() {
  const pathname = usePathname();
  const { whatsapp } = useSiteSettings();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (pathname === "/checkout" || pathname.startsWith("/order/")) return null;
  // Before the scroll threshold this was opacity-0 but still in the tab order:
  // pointer-events-none stops the mouse, not Enter.
  if (!visible) return null;

  return (
    <a
      href={waLink(whatsapp)}
      target="_blank"
      rel="noreferrer noopener"
      aria-label="Chat with Franley on WhatsApp"
      className={cn(
        "group fixed bottom-5 right-5 z-40 flex items-center gap-3 rounded-full bg-ink-900 py-3 pl-4 pr-5 text-cream-50 shadow-[0_12px_32px_-12px_rgba(23,21,20,0.7)]",
        "transition-all duration-500 ease-[--ease-lux] hover:bg-wine-700",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
      )}
    >
      <WhatsAppIcon className="h-5 w-5 shrink-0" />
      <span className="hidden text-sm font-medium sm:inline">Chat with us</span>
    </a>
  );
}
