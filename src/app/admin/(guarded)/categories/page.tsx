import type { Metadata } from "next";
import Link from "next/link";
import { Check, FolderTree } from "lucide-react";
import { AdminPageShell } from "@/components/admin/page-shell";
import { CategoryFeedback } from "@/components/admin/categories/feedback";
import { CategoryTable } from "@/components/admin/categories/category-table";
import { getCategoryTree } from "./data";

export const metadata: Metadata = { title: "Categories" };

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
        <FolderTree className="h-6 w-6" strokeWidth={1.5} aria-hidden />
      </span>
      <h2 className="mt-5 font-display text-2xl text-ink-800">No categories yet</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-600">
        Categories are how the shop is organised — the tiles on the homepage, the
        /collections pages, and the filter every product needs before it can be listed. Start with a
        top-level one such as Neckties, then add its sub-categories.
      </p>
      <Link
        href="/admin/categories/new"
        className="mt-7 inline-flex h-11 items-center justify-center rounded-full bg-ink-900 px-7 text-sm font-medium text-cream-50 transition-colors hover:bg-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
      >
        Create the first category
      </Link>
    </div>
  );
}

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const [{ saved }, { tree, all }] = await Promise.all([searchParams, getCategoryTree()]);

  const topLevel = all.filter((row) => !row.parentId).length;
  const hidden = all.filter((row) => !row.isActive).length;

  return (
    <AdminPageShell
      title="Categories"
      description="The shape of the shop. Parents hold sub-categories, sub-categories hold products, and the order here is the order shoppers see."
      action={{ href: "/admin/categories/new", label: "New category" }}
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

      {all.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <Stat label="Categories" value={all.length} />
            <Stat label="Top level" value={topLevel} />
            <Stat label="Hidden" value={hidden} />
          </div>

          <CategoryFeedback>
            <CategoryTable tree={tree} />
          </CategoryFeedback>

          <p className="mt-5 max-w-2xl text-xs leading-relaxed text-ink-600">
            The tree is two levels deep by design. A category can only be deleted once nothing is
            filed under it — move its sub-categories and products elsewhere first, and the delete
            button will tell you exactly what is still in the way.
          </p>
        </>
      )}
    </AdminPageShell>
  );
}
