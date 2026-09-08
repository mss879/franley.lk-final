import Link from "next/link";

/** Root-level fallback for paths outside the storefront layout, e.g. /admin/*. */
export default function RootNotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-cream-50 px-5 text-center">
      <div>
        <p className="eyebrow text-wine-700">Error 404</p>
        <h1 className="font-display mt-4 text-4xl">Page not found</h1>
        <Link
          href="/"
          className="mt-8 inline-flex h-12 items-center rounded-full bg-wine-700 px-7 text-sm text-cream-50 transition-colors hover:bg-wine-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
        >
          Back to Franley
        </Link>
      </div>
    </main>
  );
}
