import type { Metadata } from "next";
import Link from "next/link";
import { Check, Layers } from "lucide-react";
import { AdminPageShell } from "@/components/admin/page-shell";
import { CategoryFeedback } from "@/components/admin/categories/feedback";
import { CollectionTable } from "@/components/admin/collections/collection-table";
import { listCollections } from "./data";

export const metadata: Metadata = { title: "Collections" };

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-cream-300 bg-white px-5 py-4">
      <p className="eyebrow text-ink-600">{label}</p>
      <p className="mt-1.5 font-display text-2xl text-ink-800">{value}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-cream-300 bg-white px-6 py-16 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-cream-100 text-wine-700">
        <Layers className="h-6 w-6" strokeWidth={1.5} aria-hidden />
      </span>
      <h2 className="mt-5 font-display text-2xl text-ink-800">No collections yet</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-600">
        A collection is a hand-picked set of products from anywhere in the catalogue — a gifting
        edit, a wedding line-up, the season&rsquo;s colours — with its own page at
        /collections/&hellip; and a link in the footer. Categories stay as they are.
      </p>
      <Link
        href="/admin/collections/new"
        className="mt-7 inline-flex h-11 items-center justify-center rounded-full bg-wine-700 px-7 text-sm font-medium text-cream-50 transition-colors hover:bg-wine-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
      >
        Create the first collection
      </Link>
    </div>
  );
}

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const [{ saved }, rows] = await Promise.all([searchParams, listCollections()]);

  const active = rows.filter((row) => row.isActive).length;

  return (
    <AdminPageShell
      title="Collections"
      description="Curated edits that cut across categories. Each one is a page shoppers can browse, in the order you set here."
      action={{ href: "/admin/collections/new", label: "New collection" }}
    >
      {saved && (
        <p
          role="status"
          className="mb-6 flex items-center gap-3 rounded-2xl border border-cream-300 bg-cream-100 px-5 py-4 text-sm text-ink-800"
        >
          <Check className="h-4 w-4 shrink-0 text-wine-700" strokeWidth={1.5} aria-hidden />
          “{saved}” saved.
        </p>
      )}

      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <Stat label="Collections" value={rows.length} />
            <Stat label="Live" value={active} />
            <Stat label="Hidden" value={rows.length - active} />
          </div>

          <CategoryFeedback>
            <CollectionTable rows={rows} />
          </CategoryFeedback>

          <p className="mt-5 max-w-2xl text-xs leading-relaxed text-ink-600">
            Deleting a collection only removes the grouping — every product in it stays in the
            catalogue. Draft and archived pieces can be members, but do not show until they are
            active, and a collection with no active pieces stays off the storefront altogether.
          </p>
        </>
      )}
    </AdminPageShell>
  );
}
