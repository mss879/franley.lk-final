"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ShoppingBag, X } from "lucide-react";
import { useCart } from "@/lib/cart/cart-context";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/lib/a11y/use-focus-trap";

const NAV = [
  { href: "/shop", label: "Shop All" },
  { href: "/collections/neckties", label: "Neckties" },
  { href: "/collections/cufflinks", label: "Cufflinks" },
  { href: "/about", label: "About" },
];

export function Header() {
  const pathname = usePathname();
  const { count, openBag, ready } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const sheetCloseRef = useRef<HTMLButtonElement>(null);

  // The home hero is a full-bleed dark band, so the header floats over it in
  // light-on-dark until the user scrolls past it.
  const overHero = pathname === "/" && !scrolled;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // The sheet declares role="dialog" aria-modal="true"; this supplies the
  // behaviour that contract promises (focus in, Tab trapped, Escape, restore).
  useFocusTrap({
    active: menuOpen,
    containerRef: sheetRef,
    onClose: () => setMenuOpen(false),
    initialFocusRef: sheetCloseRef,
  });

  // Lock body scroll while the mobile sheet is open.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-colors duration-500 ease-[--ease-lux]",
        overHero
          ? "focus-on-dark bg-transparent text-cream-100"
          : "border-b border-cream-300 bg-cream-50/90 text-ink-900 backdrop-blur-md",
      )}
    >
      <div className="mx-auto flex h-20 max-w-[1400px] items-center justify-between gap-6 px-5 md:px-10">
        <Link
          href="/"
          aria-label="Franley — home"
          className="relative h-6 w-[132px] shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-4"
        >
          <Image
            src="/brand/logo-dark.png"
            alt="Franley"
            fill
            sizes="132px"
            className={cn(
              "object-contain object-left transition-all duration-500",
              // The supplied wordmark is black; invert it to read on the banner.
              overHero && "brightness-0 invert",
            )}
          />
        </Link>

        <nav className="hidden items-center gap-9 lg:flex" aria-label="Main">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative text-xs uppercase tracking-[0.18em] transition-opacity duration-300 hover:opacity-100",
                  "after:absolute after:-bottom-1.5 after:left-0 after:h-px after:bg-current after:transition-all after:duration-300 after:ease-[--ease-lux]",
                  active ? "opacity-100 after:w-full" : "opacity-70 after:w-0 hover:after:w-full",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-4",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 md:gap-3">
          <ButtonLink
            href="/contact"
            size="sm"
            variant={overHero ? "cream" : "primary"}
            className="hidden sm:inline-flex"
          >
            Contact Us
          </ButtonLink>

          <button
            type="button"
            onClick={openBag}
            aria-label={`Open bag${ready && count ? `, ${count} item${count === 1 ? "" : "s"}` : ""}`}
            className={cn(
              "relative grid h-11 w-11 place-items-center rounded-full border transition-colors duration-300",
              overHero
                ? "border-cream-100/30 hover:border-cream-100/70 hover:bg-cream-100/10"
                : "border-ink-900/15 hover:border-ink-900",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2",
            )}
          >
            <ShoppingBag className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden />
            {ready && count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-champagne-400 px-1 text-[10px] font-semibold text-ink-900">
                {count > 99 ? "99+" : count}
              </span>
            )}
            {/* The badge is the persistent bag indicator, and it changed with no
                announcement — a changed aria-label on an unfocused button is
                not read out. */}
            <span className="sr-only" aria-live="polite">
              {ready ? `${count} item${count === 1 ? "" : "s"} in your bag` : ""}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            className={cn(
              "grid h-11 w-11 place-items-center rounded-full border transition-colors duration-300 lg:hidden",
              overHero ? "border-cream-100/30" : "border-ink-900/15",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2",
            )}
          >
            <Menu className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden />
          </button>
        </div>
      </div>

      {/* Mobile sheet */}
      <div
        ref={sheetRef}
        hidden={!menuOpen}
        className="focus-on-dark fixed inset-0 z-50 bg-ink-900 text-cream-100 lg:hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
      >
        <div className="flex h-20 items-center justify-between px-5">
          <span className="font-display text-lg">Menu</span>
          <button
            ref={sheetCloseRef}
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
            className="grid h-11 w-11 place-items-center rounded-full border border-cream-100/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <X className="h-5 w-5" strokeWidth={1.5} aria-hidden />
          </button>
        </div>
        <nav className="flex flex-col px-5 pt-4" aria-label="Mobile">
          {NAV.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className="font-display border-b border-cream-100/10 py-5 text-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              style={{ animation: `fade-up 0.5s var(--ease-lux) ${i * 55}ms both` }}
            >
              {item.label}
            </Link>
          ))}
          <ButtonLink href="/contact" variant="cream" size="lg" className="mt-8" onClick={() => setMenuOpen(false)}>
            Contact Us
          </ButtonLink>
        </nav>
      </div>
    </header>
  );
}
