import type { Metadata } from "next";
import Link from "next/link";

// Next adds the noindex to every 404 on its own; this just stops the tab
// reading like the home page.
export const metadata: Metadata = { title: "Page not found" };

const linkClass =
  "text-sm text-wine-700 underline underline-offset-4 hover:text-wine-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";

/** Root-level fallback for paths outside the storefront layout, e.g. /admin/*. */
export default function RootNotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-cream-50 px-5 text-center">
      <div>
        <p className="eyebrow text-wine-700">Error 404</p>
        <h1 className="font-display mt-4 text-4xl">Page not found</h1>
        <p className="mt-4 text-sm text-ink-600">The page you were after has moved or never existed.</p>
        <Link
          href="/"
          className="mt-8 inline-flex h-12 items-center rounded-full bg-wine-700 px-7 text-sm text-cream-50 transition-colors hover:bg-wine-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
        >
          Back to Franley
        </Link>
        <nav aria-label="Popular pages" className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2">
          <Link href="/shop" className={linkClass}>Shop all</Link>
          <Link href="/collections" className={linkClass}>Collections</Link>
          <Link href="/contact" className={linkClass}>Contact us</Link>
        </nav>
      </div>
    </main>
  );
}
