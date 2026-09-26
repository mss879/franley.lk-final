"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  LayoutDashboard, Package, FolderTree, ReceiptText, Users, Layers, Settings,
  Image as ImageIcon, LogOut, Menu, X, ExternalLink,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/lib/a11y/use-focus-trap";

const LINKS = [
  { href: "/admin", label: "Dashboard", Icon: LayoutDashboard, exact: true },
  { href: "/admin/orders", label: "Orders", Icon: ReceiptText },
  { href: "/admin/customers", label: "Customers", Icon: Users },
  { href: "/admin/products", label: "Products", Icon: Package },
  { href: "/admin/categories", label: "Categories", Icon: FolderTree },
  { href: "/admin/collections", label: "Collections", Icon: Layers },
  { href: "/admin/content", label: "Content & Banners", Icon: ImageIcon },
  { href: "/admin/settings", label: "Settings", Icon: Settings },
];

export function AdminNav({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // The drawer is a full-screen overlay that had no dialog semantics at all:
  // no role, no focus management, no Escape, and the page behind it stayed in
  // the tab order. Same defect and same fix as the storefront header.
  useFocusTrap({ active: open, containerRef: drawerRef, onClose: () => setOpen(false) });

  const signOut = async () => {
    await createClient().auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  };

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const nav = (
    <nav className="flex flex-1 flex-col gap-1" aria-label="Admin">
      {LINKS.map(({ href, label, Icon, exact }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setOpen(false)}
          aria-current={isActive(href, exact) ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-colors duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
            isActive(href, exact)
              ? "bg-cream-100/12 text-cream-50"
              : "text-cream-100/60 hover:bg-cream-100/6 hover:text-cream-100",
          )}
        >
          <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );

  const footer = (
    <div className="border-t border-cream-100/12 pt-4">
      <Link
        href="/"
        target="_blank"
        className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-cream-100/60 transition-colors hover:text-cream-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      >
        <ExternalLink className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden />
        View storefront
      </Link>
      <div className="mt-3 rounded-xl bg-cream-100/6 px-4 py-3">
        <p className="eyebrow text-champagne-300">Signed in</p>
        <p className="mt-1 truncate text-xs text-cream-100/70">{email}</p>
        <button
          type="button"
          onClick={signOut}
          className="mt-3 flex items-center gap-2 text-xs text-cream-100/60 transition-colors hover:text-cream-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile bar */}
      <div className="focus-on-wine sticky top-0 z-40 flex h-16 items-center justify-between border-b border-cream-100/12 bg-wine-900 px-4 lg:hidden">
        <Image src="/brand/logo-dark.png" alt="Franley admin" width={120} height={24} className="h-5 w-auto brightness-0 invert" />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="grid h-10 w-10 place-items-center rounded-full border border-cream-100/20 text-cream-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          {open ? <X className="h-4 w-4" aria-hidden /> : <Menu className="h-4 w-4" aria-hidden />}
        </button>
      </div>

      <div
        ref={drawerRef}
        hidden={!open}
        role="dialog"
        aria-modal="true"
        aria-label="Admin menu"
        className="focus-on-wine fixed inset-x-0 bottom-0 top-16 z-40 flex flex-col bg-wine-900 p-4 lg:hidden"
      >
        {nav}
        {footer}
      </div>

      {/* Desktop sidebar */}
      <aside className="focus-on-wine sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-wine-900 p-4 lg:flex">
        <div className="px-4 py-6">
          <Image src="/brand/logo-dark.png" alt="Franley admin" width={140} height={28} className="h-6 w-auto brightness-0 invert" />
          <p className="eyebrow mt-3 text-champagne-300">Admin</p>
        </div>
        {nav}
        {footer}
      </aside>
    </>
  );
}
