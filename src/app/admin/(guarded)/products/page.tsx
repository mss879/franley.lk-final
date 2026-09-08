import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Package } from "lucide-react";
import { AdminPageShell } from "@/components/admin/page-shell";
import { ProductFilters } from "@/components/admin/products/product-filters";
import { ProductRowActions } from "@/components/admin/products/row-actions";
import {
  PRODUCT_STATUSES,
  STATUS_BADGE,
  STATUS_LABEL,
  resolveImageSrc,
  stockState,
  type ProductStatus,
} from "@/components/admin/products/shared";
import { ButtonLink } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { cn, formatPrice } from "@/lib/utils";
import { getCategoryOptions, one } from "./queries";

export const metadata: Metadata = { title: "Products" };

const PAGE_SIZE = 25;

type SearchParams = { q?: string; status?: string; category?: string; page?: string };

type Row = {
  id: string;
  slug: string;
  title: string;
  price_cents: number;
  compare_at_cents: number | null;
  stock: number;
  low_stock_threshold: number;
  status: ProductStatus;
  featured: boolean;
  position: number;
  category: { id: string; name: string } | { id: string; name: string }[] | null;
  product_images: { url: string; alt: string | null }[] | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const th = "px-4 py-3 text-left text-[11px] font-medium uppercase tracking-[0.14em] text-ink-600";

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const status = PRODUCT_STATUSES.find((s) => s === sp.status);
  const search = (sp.q ?? "").trim();
  // A malformed id would come back from PostgREST as a 400, not an empty list.
  const categoryId = sp.category && UUID_RE.test(sp.category) ? sp.category : undefined;
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  const categories = await getCategoryOptions();

  let query = supabase
    .from("products")
    .select(
      "id, slug, title, price_cents, compare_at_cents, stock, low_stock_threshold, status, featured, position, category:category_id(id, name), product_images(url, alt)",
      { count: "exact" },
    );

  if (status) query = query.eq("status", status);
  if (categoryId) query = query.eq("category_id", categoryId);
  if (search) {
    // PostgREST reads these as filter syntax inside an ilike pattern.
    query = query.ilike("title", `%${search.replace(/[%_,()]/g, " ")}%`);
  }

  const { data, count, error } = await query
    .order("position", { ascending: true })
    .order("title", { ascending: true })
    .order("position", { ascending: true, referencedTable: "product_images" })
    .limit(1, { referencedTable: "product_images" })
    .range(from, from + PAGE_SIZE - 1);

  if (error) throw error;

  const rows = (data ?? []) as unknown as Row[];
  const total = count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(search || status || categoryId);

  const pageHref = (n: number) => {
    const next = new URLSearchParams();
    if (search) next.set("q", search);
    if (status) next.set("status", status);
    if (categoryId) next.set("category", categoryId);
    if (n > 1) next.set("page", String(n));
    const qs = next.toString();
    return qs ? `/admin/products?${qs}` : "/admin/products";
  };

  return (
    <AdminPageShell
      title="Products"
      description="Every piece in the catalogue. Archive rather than delete — order history points back here."
      action={{ href: "/admin/products/new", label: "New product" }}
    >
      {/* useSearchParams needs a boundary so this page can never be forced into
          a static-prerender bailout by an upstream config change. */}
      <Suspense fallback={<div className="h-[92px] rounded-3xl border border-cream-300 bg-white" />}>
        <ProductFilters categories={categories} />
      </Suspense>

      <p aria-live="polite" className="mt-4 text-xs text-ink-600">
        {total === 0
          ? "No products match."
          : `${total} product${total === 1 ? "" : "s"}${filtered ? " matching" : ""} · page ${page} of ${lastPage}`}
      </p>

      {rows.length === 0 ? (
        <EmptyState filtered={filtered || total > 0} />
      ) : (
        <div className="mt-4 overflow-hidden rounded-3xl border border-cream-300 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <caption className="sr-only">Products, with price, stock and status</caption>
              <thead>
                <tr className="border-b border-cream-300 bg-cream-50">
                  <th scope="col" className={cn(th, "w-[64px]")}>
                    <span className="sr-only">Image</span>
                  </th>
                  <th scope="col" className={th}>Product</th>
                  <th scope="col" className={th}>Category</th>
                  <th scope="col" className={cn(th, "text-right")}>Price</th>
                  <th scope="col" className={cn(th, "text-right")}>Stock</th>
                  <th scope="col" className={th}>Status</th>
                  <th scope="col" className={cn(th, "text-right")}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const image = row.product_images?.[0] ?? null;
                  const category = one(row.category);
                  const stock = stockState(row.stock, row.low_stock_threshold);
                  const onSale =
                    row.compare_at_cents != null && row.compare_at_cents > row.price_cents;

                  return (
                    <tr key={row.id} className="border-b border-cream-300/70 last:border-0 align-middle">
                      <td className="py-3 pl-4">
                        <div className="relative h-14 w-11 overflow-hidden rounded-xl border border-cream-300 bg-white">
                          {image ? (
                            <Image
                              src={resolveImageSrc(image.url)}
                              alt=""
                              fill
                              sizes="44px"
                              className="object-contain p-1"
                            />
                          ) : (
                            <span className="grid h-full place-items-center text-[9px] text-ink-600">
                              None
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/products/${row.id}/edit`}
                          className="font-display text-base text-ink-900 transition-colors hover:text-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 rounded-sm"
                        >
                          {row.title}
                        </Link>
                        <p className="mt-0.5 text-xs text-ink-600">
                          /{row.slug}
                          {row.featured && <span className="ml-2 text-champagne-600">Featured</span>}
                        </p>
                      </td>

                      <td className="px-4 py-3 text-ink-600">{category?.name ?? "—"}</td>

                      <td className="px-4 py-3 text-right tabular-nums text-ink-800">
                        {formatPrice(row.price_cents)}
                        {onSale && (
                          <span className="block text-xs text-ink-600 line-through">
                            {formatPrice(row.compare_at_cents!)}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <span className="tabular-nums text-ink-800">{row.stock}</span>
                        {stock !== "ok" && (
                          <span
                            className={cn(
                              "mt-1 block rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                              stock === "out"
                                ? "border-wine-700/30 bg-wine-50 text-wine-700"
                                : "border-champagne-400 bg-champagne-100 text-ink-800",
                            )}
                          >
                            {stock === "out" ? "Out of stock" : `Low · at ${row.low_stock_threshold}`}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-block rounded-full border px-3 py-1 text-[10px] font-medium uppercase tracking-wider",
                            STATUS_BADGE[row.status],
                          )}
                        >
                          {STATUS_LABEL[row.status]}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <ProductRowActions id={row.id} title={row.title} status={row.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {lastPage > 1 && (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-4">
          <PageLink href={pageHref(page - 1)} disabled={page <= 1} rel="prev">
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            Previous
          </PageLink>
          <span className="text-xs text-ink-600">
            Page {page} of {lastPage}
          </span>
          <PageLink href={pageHref(page + 1)} disabled={page >= lastPage} rel="next">
            Next
            <ChevronRight className="h-4 w-4" strokeWidth={1.5} aria-hidden />
          </PageLink>
        </nav>
      )}
    </AdminPageShell>
  );
}

function PageLink({
  href,
  disabled,
  rel,
  children,
}: {
  href: string;
  disabled: boolean;
  rel: string;
  children: React.ReactNode;
}) {
  const className =
    "inline-flex h-10 items-center gap-1.5 rounded-full border border-cream-300 px-5 text-xs text-ink-600 transition-colors duration-200 hover:border-wine-700 hover:text-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2";

  if (disabled) {
    return (
      <span aria-disabled className={cn(className, "pointer-events-none opacity-40")}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} rel={rel} className={className}>
      {children}
    </Link>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="mt-4 rounded-3xl border border-dashed border-cream-300 bg-white px-6 py-20 text-center">
      <Package className="mx-auto h-8 w-8 text-ink-400" strokeWidth={1.25} aria-hidden />
      <p className="font-display mt-4 text-2xl text-ink-900">
        {filtered ? "Nothing matches those filters" : "No products yet"}
      </p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-ink-600">
        {filtered
          ? "Try a different category or status, or clear the search."
          : "Add the first piece to the catalogue — title, price, a photograph, and it is on the storefront."}
      </p>
      {!filtered && (
        <ButtonLink href="/admin/products/new" size="lg" className="mt-7">
          Add a product
        </ButtonLink>
      )}
    </div>
  );
}
