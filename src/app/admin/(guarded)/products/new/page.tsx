import type { Metadata } from "next";
import { ImagePlus } from "lucide-react";
import { AdminPageShell } from "@/components/admin/page-shell";
import { EMPTY_PRODUCT, ProductForm } from "@/components/admin/products/product-form";
import { getCategoryOptions } from "../queries";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  const categories = await getCategoryOptions();

  return (
    <AdminPageShell
      title="New product"
      description="Create the record first, then add its photographs. New products start as drafts."
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
          <section className="rounded-3xl border border-dashed border-cream-300 bg-white p-6 text-center md:p-7">
            <ImagePlus className="mx-auto h-6 w-6 text-ink-400" strokeWidth={1.25} aria-hidden />
            <h2 className="font-display mt-3 text-lg text-ink-900">Photographs come next</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-600">
              Images are filed under the product’s own folder in storage, so they can only be
              uploaded once the product exists. Create it and you land straight on the gallery.
            </p>
          </section>
        </ProductForm>
      )}
    </AdminPageShell>
  );
}
