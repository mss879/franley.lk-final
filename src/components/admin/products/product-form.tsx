"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createProduct, updateProduct } from "@/app/admin/(guarded)/products/actions";
import { ProductCard } from "@/components/shop/product-card";
import { Button } from "@/components/ui/button";
import { cn, slugify } from "@/lib/utils";
import { FormSection, SelectField, TextAreaField, TextField, inputClass } from "./fields";
import {
  HEX_RE,
  PRODUCT_STATUSES,
  SLUG_RE,
  STATUS_LABEL,
  type CategoryOption,
  type ProductStatus,
} from "./shared";

export type ProductFormValues = {
  title: string;
  slug: string;
  description: string;
  categoryId: string;
  price: string;
  compareAt: string;
  stock: string;
  lowStockThreshold: string;
  colorName: string;
  colorHex: string;
  widthCm: string;
  featured: boolean;
  status: ProductStatus;
  position: string;
};

export const EMPTY_PRODUCT: ProductFormValues = {
  title: "",
  slug: "",
  description: "",
  categoryId: "",
  price: "",
  compareAt: "",
  stock: "0",
  lowStockThreshold: "3",
  colorName: "",
  colorHex: "",
  widthCm: "",
  featured: false,
  status: "draft",
  position: "0",
};

const DEFAULT_SWATCH = "#711625";

export function ProductForm({
  mode,
  productId,
  initial,
  categories,
  previewImage,
  children,
}: {
  mode: "create" | "edit";
  productId?: string;
  initial: ProductFormValues;
  categories: CategoryOption[];
  previewImage: string | null;
  /** The image manager — rendered under the form, never inside it. */
  children?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(
    mode === "create" ? createProduct : updateProduct,
    null,
  );
  const [values, setValues] = useState(initial);
  // Once the slug has been typed in, stop rewriting it from the title.
  const [slugPinned, setSlugPinned] = useState(mode === "edit" && initial.slug !== "");

  const set = <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const priceNumber = Number.parseFloat(values.price);
  const compareNumber = Number.parseFloat(values.compareAt);

  const clientErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (values.slug && !SLUG_RE.test(values.slug)) {
      errors.slug = "Lowercase letters, numbers and single hyphens only — for example fine-twill-navy.";
    }
    if (values.compareAt) {
      if (!Number.isFinite(compareNumber) || compareNumber <= 0) {
        errors.compareAt = "Enter an amount in rupees, or leave this empty.";
      } else if (Number.isFinite(priceNumber) && compareNumber <= priceNumber) {
        errors.compareAt =
          "The compare-at price is the crossed-out original, so it must be higher than the price.";
      }
    }
    if (values.colorHex && !HEX_RE.test(values.colorHex)) {
      errors.colorHex = "Use a six-digit hex colour, for example #711625.";
    }
    return errors;
  }, [values.slug, values.compareAt, values.colorHex, priceNumber, compareNumber]);

  const errorFor = (name: string) => clientErrors[name] ?? state?.fieldErrors?.[name];

  const categoryName = categories.find((c) => c.id === values.categoryId)?.name ?? null;

  const grouped = useMemo(() => {
    const roots = categories.filter((c) => !c.parentName);
    const byParent = new Map<string, CategoryOption[]>();
    for (const c of categories) {
      if (!c.parentName) continue;
      byParent.set(c.parentName, [...(byParent.get(c.parentName) ?? []), c]);
    }
    return { roots, byParent };
  }, [categories]);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="min-w-0 space-y-8">
        <form action={formAction} className="space-y-6">
          {productId && <input type="hidden" name="id" value={productId} />}

          <FormSection title="Identity" description="What the piece is called, and where it lives on the site.">
            <TextField
              id="title"
              name="title"
              label="Title"
              required
              maxLength={200}
              wrapClass="sm:col-span-2"
              value={values.title}
              error={errorFor("title")}
              onChange={(e) => {
                const title = e.target.value;
                setValues((v) => ({ ...v, title, slug: slugPinned ? v.slug : slugify(title) }));
              }}
            />

            <TextField
              id="slug"
              name="slug"
              label="Slug"
              required
              maxLength={96}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              wrapClass="sm:col-span-2"
              value={values.slug}
              error={errorFor("slug")}
              hint={`Public address: /products/${values.slug || "…"}`}
              title="Lowercase letters, numbers and single hyphens"
              onChange={(e) => {
                setSlugPinned(true);
                set("slug", e.target.value.toLowerCase());
              }}
            />

            <SelectField
              id="categoryId"
              name="categoryId"
              label="Category"
              required
              value={values.categoryId}
              error={errorFor("categoryId")}
              onChange={(e) => set("categoryId", e.target.value)}
            >
              <option value="" disabled>
                Choose a category
              </option>
              {grouped.roots.map((root) => {
                const children = grouped.byParent.get(root.name) ?? [];
                if (!children.length) {
                  return (
                    <option key={root.id} value={root.id}>
                      {root.name}
                    </option>
                  );
                }
                return (
                  <optgroup key={root.id} label={root.name}>
                    <option value={root.id}>{root.name} (top level)</option>
                    {children.map((child) => (
                      <option key={child.id} value={child.id}>
                        {child.name}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </SelectField>

            <SelectField
              id="status"
              name="status"
              label="Status"
              required
              value={values.status}
              error={errorFor("status")}
              hint="Only active products appear on the storefront."
              onChange={(e) => set("status", e.target.value as ProductStatus)}
            >
              {PRODUCT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </SelectField>

            <TextAreaField
              id="description"
              name="description"
              label="Description"
              maxLength={8000}
              wrapClass="sm:col-span-2"
              value={values.description}
              error={errorFor("description")}
              hint="Specific about make and material. Woven in a fine twill, not “amazing quality”."
              onChange={(e) => set("description", e.target.value)}
            />
          </FormSection>

          <FormSection title="Price" description="Entered in rupees. Stored to the cent.">
            <TextField
              id="price"
              name="price"
              label="Price (Rs)"
              required
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={values.price}
              error={errorFor("price")}
              onChange={(e) => set("price", e.target.value)}
            />
            <TextField
              id="compareAt"
              name="compareAt"
              label="Compare-at price (Rs)"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={values.compareAt}
              error={errorFor("compareAt")}
              hint="Optional. The struck-through original — must be higher than the price."
              onChange={(e) => set("compareAt", e.target.value)}
            />
          </FormSection>

          <FormSection title="Stock" description="The threshold drives the low-stock flag on the products list.">
            <TextField
              id="stock"
              name="stock"
              label="Stock on hand"
              required
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={values.stock}
              error={errorFor("stock")}
              onChange={(e) => set("stock", e.target.value)}
            />
            <TextField
              id="lowStockThreshold"
              name="lowStockThreshold"
              label="Low stock threshold"
              required
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={values.lowStockThreshold}
              error={errorFor("lowStockThreshold")}
              hint="Flagged once stock falls to this number or below."
              onChange={(e) => set("lowStockThreshold", e.target.value)}
            />
          </FormSection>

          <FormSection title="Detail" description="Shown on the product page and used by the shop colour filter.">
            <TextField
              id="colorName"
              name="colorName"
              label="Colour name"
              maxLength={40}
              value={values.colorName}
              error={errorFor("colorName")}
              placeholder="Burgundy"
              onChange={(e) => set("colorName", e.target.value)}
            />

            <div className="space-y-1.5">
              <label htmlFor="colorHex" className="block text-xs font-medium text-ink-600">
                Colour swatch
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  id="colorHexPicker"
                  aria-label="Pick the colour swatch"
                  value={HEX_RE.test(values.colorHex) ? values.colorHex : DEFAULT_SWATCH}
                  onChange={(e) => set("colorHex", e.target.value.toLowerCase())}
                  className="h-11 w-14 shrink-0 cursor-pointer rounded-full border border-cream-300 bg-white p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
                />
                <input
                  id="colorHex"
                  name="colorHex"
                  value={values.colorHex}
                  onChange={(e) => set("colorHex", e.target.value.toLowerCase())}
                  placeholder="#711625"
                  maxLength={7}
                  pattern="#[0-9a-fA-F]{6}"
                  aria-invalid={errorFor("colorHex") ? true : undefined}
                  aria-describedby={errorFor("colorHex") ? "colorHex-error" : "colorHex-hint"}
                  className={cn(inputClass, "font-mono")}
                />
                {values.colorHex && (
                  <button
                    type="button"
                    onClick={() => set("colorHex", "")}
                    className="shrink-0 text-xs text-ink-600 underline underline-offset-4 hover:text-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
                  >
                    Clear
                  </button>
                )}
              </div>
              {errorFor("colorHex") ? (
                <p id="colorHex-error" className="text-xs text-wine-700">{errorFor("colorHex")}</p>
              ) : (
                <p id="colorHex-hint" className="text-xs text-ink-600">Optional. Six-digit hex, e.g. #711625.</p>
              )}
            </div>

            <TextField
              id="widthCm"
              name="widthCm"
              label="Blade width (cm)"
              type="number"
              min="1"
              max="20"
              step="0.1"
              inputMode="decimal"
              value={values.widthCm}
              error={errorFor("widthCm")}
              hint="Between 1 and 20, to one decimal place."
              onChange={(e) => set("widthCm", e.target.value)}
            />

            <TextField
              id="position"
              name="position"
              label="Position"
              required
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={values.position}
              error={errorFor("position")}
              hint="Lower numbers sort first within a collection."
              onChange={(e) => set("position", e.target.value)}
            />

            <div className="sm:col-span-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-cream-300 px-4 py-3">
                <input
                  type="checkbox"
                  name="featured"
                  checked={values.featured}
                  onChange={(e) => set("featured", e.target.checked)}
                  className="h-4 w-4 shrink-0 rounded border-cream-300 accent-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
                />
                <span className="text-sm text-ink-800">
                  Featured
                  <span className="block text-xs text-ink-600">
                    Featured active products are pulled into the home page rail.
                  </span>
                </span>
              </label>
            </div>
          </FormSection>

          <div
            aria-live="polite"
            className={cn(
              "rounded-2xl border px-4 py-3 text-sm",
              !state && "hidden",
              state?.ok
                ? "border-cream-300 bg-cream-100 text-ink-800"
                : "border-wine-700/25 bg-wine-50 text-wine-700",
            )}
          >
            {state?.message}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {mode === "create" ? "Create product" : "Save changes"}
            </Button>
            <Link
              href="/admin/products"
              className="text-sm text-ink-600 underline underline-offset-4 transition-colors hover:text-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
            >
              Back to products
            </Link>
          </div>
        </form>

        {children}
      </div>

      <aside className="lg:sticky lg:top-8 lg:h-fit">
        <h2 className="eyebrow text-ink-600">Storefront preview</h2>
        <div className="mt-4 rounded-3xl border border-cream-300 bg-cream-50 p-5">
          <div inert>
            <ProductCard
              product={{
                slug: values.slug || "preview",
                title: values.title || "Untitled piece",
                priceCents: Number.isFinite(priceNumber) ? Math.round(priceNumber * 100) : 0,
                compareAtCents:
                  Number.isFinite(compareNumber) && compareNumber > priceNumber
                    ? Math.round(compareNumber * 100)
                    : null,
                image: previewImage,
                colorName: values.colorName || null,
                colorHex: HEX_RE.test(values.colorHex) ? values.colorHex : null,
                categoryName,
                soldOut: Number.parseInt(values.stock, 10) === 0,
              }}
            />
          </div>
        </div>
        <p className="mt-3 text-xs text-ink-600">
          The card as it renders in a collection grid. The photograph is the first image in the
          gallery below.
        </p>
      </aside>
    </div>
  );
}
