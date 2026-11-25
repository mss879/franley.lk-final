import type { Metadata } from "next";
import { AdminPageShell } from "@/components/admin/page-shell";
import { EMPTY_PRODUCT, ProductForm } from "@/components/admin/products/product-form";
import { NewProductPhotos } from "@/components/admin/products/new-product-photos";
import { getCategoryOptions } from "../queries";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  const categories = await getCategoryOptions();

  return (
    <AdminPageShell
      title="New product"
      description="Fill in the details and add photographs, then press Create. New products start as drafts."
    >
      {categories.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-cream-300 bg-white px-6 py-16 text-center">
          <p className="font-display text-2xl text-ink-900">No categories yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-600">
            Every product has to be filed into a category. Create one under Categories first.
          </p>
        </div>
      ) : (
        <ProductForm mode="create" initial={EMPTY_PRODUCT} categories={categories} previewImage={null}>
          <NewProductPhotos />
        </ProductForm>
      )}
    </AdminPageShell>
  );
}
