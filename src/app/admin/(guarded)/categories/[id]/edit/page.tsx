import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { AdminPageShell } from "@/components/admin/page-shell";
import { CategoryForm } from "@/components/admin/categories/category-form";
import { CategoryProducts } from "@/components/admin/categories/category-products";
import { updateCategory } from "../../actions";
import {
  eligibleParents,
  getProductsInCategory,
  listCategories,
  type CategoryRow,
} from "../../data";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const category = (await listCategories()).find((row) => row.id === id);
  return { title: category ? `Edit ${category.name}` : "Category" };
}

/** "Neckties › Striped Ties", so the move-product select is unambiguous. */
function labelFor(row: CategoryRow, all: CategoryRow[]) {
  const parent = row.parentId ? all.find((c) => c.id === row.parentId) : null;
  return parent ? `${parent.name} › ${row.name}` : row.name;
}

export default async function EditCategoryPage({ params }: Params) {
  const { id } = await params;
  const all = await listCategories();
  const category = all.find((row) => row.id === id);
  if (!category) notFound();

  const products = await getProductsInCategory(id);
  const childCount = all.filter((row) => row.parentId === id).length;

  const destinations = all
    .filter((row) => row.id !== id)
    .map((row) => ({ id: row.id, label: labelFor(row, all) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <AdminPageShell
      title={category.name}
      description={`Editing the ${category.parentId ? "sub-category" : "top-level category"} at /collections/${category.slug}.`}
    >
      <div className="mb-6 flex flex-wrap items-center gap-5">
        <Link
          href="/admin/categories"
          className="inline-flex items-center gap-1.5 text-xs text-ink-600 transition-colors hover:text-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
          All categories
        </Link>
        {category.isActive && (
          <Link
            href={`/collections/${category.slug}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 text-xs text-ink-600 transition-colors hover:text-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
          >
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
            View on the storefront
          </Link>
        )}
      </div>

      <div className="max-w-3xl space-y-10">
        <CategoryForm
          action={updateCategory}
          submitLabel="Save changes"
          parents={eligibleParents(all, id).map((row) => ({ id: row.id, name: row.name }))}
          parentLockReason={
            childCount > 0
              ? `“${category.name}” has ${childCount} sub-categor${childCount === 1 ? "y" : "ies"} of its own, so it has to stay top level. Move those out first if you want to file it under something.`
              : undefined
          }
          initial={{
            id: category.id,
            name: category.name,
            slug: category.slug,
            description: category.description ?? "",
            parentId: category.parentId ?? "",
            position: category.position,
            isActive: category.isActive,
            imageUrl: category.imageUrl ?? "",
          }}
        />

        <section>
          <h2 className="font-display text-2xl text-ink-800">Products in this category</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">
            Everything filed here, including drafts and archived pieces. Move one out before you
            delete this category — the full product record is edited over in Products.
          </p>
          <div className="mt-5">
            <CategoryProducts
              categoryName={category.name}
              products={products}
              destinations={destinations}
            />
          </div>
        </section>
      </div>
    </AdminPageShell>
  );
}
