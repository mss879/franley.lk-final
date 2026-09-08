import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { AdminPageShell } from "@/components/admin/page-shell";
import { ProductForm, type ProductFormValues } from "@/components/admin/products/product-form";
import { ProductImages, type ProductImageRow } from "@/components/admin/products/product-images";
import { resolveImageSrc, type ProductStatus } from "@/components/admin/products/shared";
import { createClient } from "@/lib/supabase/server";
import { getCategoryOptions } from "../../queries";

export const metadata: Metadata = { title: "Edit product" };

type ProductRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category_id: string;
  price_cents: number;
  compare_at_cents: number | null;
  color_name: string | null;
  color_hex: string | null;
  width_cm: number | string | null;
  stock: number;
  low_stock_threshold: number;
  featured: boolean;
  status: ProductStatus;
  position: number;
};

const rupees = (cents: number | null) => (cents == null ? "" : (cents / 100).toFixed(2));

/** A non-uuid id makes PostgREST answer 400, which would surface as a 500 page
 *  rather than a 404. Same guard the orders detail route uses. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();

  const [{ data, error }, imagesResult, categories] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, slug, title, description, category_id, price_cents, compare_at_cents, color_name, color_hex, width_cm, stock, low_stock_threshold, featured, status, position",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("product_images")
      .select("id, url, alt, position")
      .eq("product_id", id)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
    getCategoryOptions(),
  ]);

  if (error) throw error;
  if (!data) notFound();

  const product = data as ProductRow;
  const images = (imagesResult.data ?? []) as ProductImageRow[];

  const initial: ProductFormValues = {
    title: product.title,
    slug: product.slug,
    description: product.description ?? "",
    categoryId: product.category_id,
    price: rupees(product.price_cents),
    compareAt: rupees(product.compare_at_cents),
    stock: String(product.stock),
    lowStockThreshold: String(product.low_stock_threshold),
    colorName: product.color_name ?? "",
    colorHex: product.color_hex?.toLowerCase() ?? "",
    // numeric(3,1) arrives as a string from PostgREST; drop the trailing ".0".
    widthCm: product.width_cm == null ? "" : String(product.width_cm).replace(/\.0$/, ""),
    featured: product.featured,
    status: product.status,
    position: String(product.position),
  };

  return (
    <AdminPageShell
      title={product.title}
      description={`Editing /products/${product.slug}. Changes go live as soon as they are saved.`}
    >
      {sp.created && (
        <p
          role="status"
          className="mb-6 rounded-2xl border border-cream-300 bg-cream-100 px-4 py-3 text-sm text-ink-800"
        >
          Product created. Add its photographs below, then set the status to Active when it is ready.
        </p>
      )}

      {product.status === "active" && (
        <p className="mb-6 text-sm">
          <Link
            href={`/products/${product.slug}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 text-ink-600 underline underline-offset-4 transition-colors hover:text-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
          >
            View on the storefront
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
          </Link>
        </p>
      )}

      <ProductForm
        mode="edit"
        productId={product.id}
        initial={initial}
        categories={categories}
        previewImage={images[0] ? resolveImageSrc(images[0].url) : null}
      >
        <ProductImages productId={product.id} productTitle={product.title} images={images} />
      </ProductForm>
    </AdminPageShell>
  );
}
