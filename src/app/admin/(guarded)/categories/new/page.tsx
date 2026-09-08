import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AdminPageShell } from "@/components/admin/page-shell";
import { CategoryForm } from "@/components/admin/categories/category-form";
import { createCategory } from "../actions";
import { eligibleParents, listCategories, nextPosition } from "../data";

export const metadata: Metadata = { title: "New category" };

export default async function NewCategoryPage() {
  const all = await listCategories();

  return (
    <AdminPageShell
      title="New category"
      description="A collection shoppers can browse. Sub-categories roll up into their parent, so a product filed under Striped Ties also appears under Neckties."
    >
      <Link
        href="/admin/categories"
        className="mb-6 inline-flex items-center gap-1.5 text-xs text-ink-600 transition-colors hover:text-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
      >
        <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
        All categories
      </Link>

      <div className="max-w-3xl">
        <CategoryForm
          action={createCategory}
          submitLabel="Create category"
          parents={eligibleParents(all, null).map((row) => ({ id: row.id, name: row.name }))}
          initial={{
            name: "",
            slug: "",
            description: "",
            parentId: "",
            position: nextPosition(all, null),
            isActive: true,
            imageUrl: "",
          }}
        />
      </div>
    </AdminPageShell>
  );
}
