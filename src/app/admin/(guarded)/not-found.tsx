import Link from "next/link";

/** Keeps the admin nav in place when a record id no longer resolves. */
export default function AdminNotFound() {
  return (
    <div className="mx-auto max-w-[1200px] px-5 py-8 md:px-8 md:py-10">
      <div className="rounded-3xl border border-dashed border-cream-300 bg-white px-6 py-16 text-center">
        <p className="eyebrow text-ink-600">Error 404</p>
        <h1 className="font-display mt-4 text-2xl text-ink-900">Not found</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-600">
          That record does not exist, or it has been deleted since the link was
          made.
        </p>
        <Link
          href="/admin"
          className="mt-8 inline-flex h-11 items-center justify-center rounded-full bg-wine-700 px-6 text-sm font-medium text-cream-50 transition-colors duration-300 hover:bg-wine-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
        >
          Back to the dashboard
        </Link>
      </div>
    </div>
  );
}
