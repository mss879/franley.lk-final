"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/admin-guard";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";
import {
  HEX_RE,
  PRODUCT_IMAGE_BUCKET,
  PRODUCT_STATUSES,
  SLUG_RE,
  productImageStorageKey,
  type ActionResult,
  type ProductFormState,
} from "@/components/admin/products/shared";

/**
 * Products appear on the home page, /shop, every collection and their own
 * detail page, all of which are ISR'd. One layout-level revalidation is
 * cheaper to reason about than enumerating five path patterns per write.
 */
function revalidateCatalogue() {
  revalidatePath("/admin/products");
  revalidatePath("/", "layout");
}

function field(fd: FormData, key: string): string | undefined {
  const raw = fd.get(key);
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed === "" ? undefined : trimmed;
}

function issuesToFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

const productSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Give the product a title of at least two characters.")
    .max(200, "Keep the title under 200 characters."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(96, "Keep the slug under 96 characters.")
    .regex(SLUG_RE, "Lowercase letters, numbers and single hyphens only — for example fine-twill-navy."),
  description: z.string().trim().max(8000, "The description is limited to 8,000 characters.").optional(),
  categoryId: z.uuid("Choose a category."),
  price: z.coerce
    .number()
    .positive("Enter a price in rupees, greater than zero.")
    .max(1_000_000, "That price is above the Rs 1,000,000 ceiling."),
  compareAt: z.coerce
    .number()
    .positive("The compare-at price must be greater than zero, or left empty.")
    .max(1_000_000, "That compare-at price is above the Rs 1,000,000 ceiling.")
    .optional(),
  stock: z.coerce
    .number()
    .int("Stock must be a whole number.")
    .min(0, "Stock cannot be negative.")
    .max(1_000_000, "That stock figure is implausibly large."),
  lowStockThreshold: z.coerce
    .number()
    .int("The low stock threshold must be a whole number.")
    .min(0, "The low stock threshold cannot be negative.")
    .max(10_000, "That threshold is implausibly large."),
  colorName: z.string().trim().max(40, "Keep the colour name under 40 characters.").optional(),
  colorHex: z
    .string()
    .trim()
    .toLowerCase()
    .regex(HEX_RE, "Use a six-digit hex colour, for example #711625.")
    .optional(),
  widthCm: z.coerce
    .number()
    .min(1, "Blade width must be between 1 and 20 cm.")
    .max(20, "Blade width must be between 1 and 20 cm.")
    .optional(),
  featured: z.boolean(),
  status: z.enum(PRODUCT_STATUSES),
  position: z.coerce
    .number()
    .int("Position must be a whole number.")
    .min(0, "Position cannot be negative.")
    .max(100_000, "Position is out of range."),
});

type ProductRow = {
  title: string;
  slug: string;
  description: string | null;
  category_id: string;
  price_cents: number;
  compare_at_cents: number | null;
  color_name: string | null;
  color_hex: string | null;
  width_cm: number | null;
  stock: number;
  low_stock_threshold: number;
  featured: boolean;
  status: (typeof PRODUCT_STATUSES)[number];
  position: number;
};

function parseProduct(
  fd: FormData,
): { ok: true; row: ProductRow } | { ok: false; state: ProductFormState } {
  const title = field(fd, "title") ?? "";
  const parsed = productSchema.safeParse({
    title,
    slug: field(fd, "slug") ?? slugify(title),
    description: field(fd, "description"),
    categoryId: field(fd, "categoryId") ?? "",
    price: field(fd, "price") ?? "",
    compareAt: field(fd, "compareAt"),
    stock: field(fd, "stock") ?? "0",
    lowStockThreshold: field(fd, "lowStockThreshold") ?? "0",
    colorName: field(fd, "colorName"),
    colorHex: field(fd, "colorHex"),
    widthCm: field(fd, "widthCm"),
    featured: fd.get("featured") != null,
    status: field(fd, "status") ?? "draft",
    position: field(fd, "position") ?? "0",
  });

  if (!parsed.success) {
    return {
      ok: false,
      state: { ok: false, message: "Some fields need attention.", fieldErrors: issuesToFieldErrors(parsed.error) },
    };
  }

  const v = parsed.data;
  const priceCents = Math.round(v.price * 100);
  const compareAtCents = v.compareAt == null ? null : Math.round(v.compareAt * 100);

  // The DB check is on cents, so compare there: two rupee figures a fraction of
  // a cent apart both round to the same integer and would fail at the database.
  if (compareAtCents != null && compareAtCents <= priceCents) {
    return {
      ok: false,
      state: {
        ok: false,
        message: "Some fields need attention.",
        fieldErrors: {
          compareAt: "The compare-at price must be strictly higher than the price, or left empty.",
        },
      },
    };
  }

  return {
    ok: true,
    row: {
      title: v.title,
      slug: v.slug,
      description: v.description ?? null,
      category_id: v.categoryId,
      price_cents: priceCents,
      compare_at_cents: compareAtCents,
      color_name: v.colorName ?? null,
      color_hex: v.colorHex ?? null,
      width_cm: v.widthCm ?? null,
      stock: v.stock,
      low_stock_threshold: v.lowStockThreshold,
      featured: v.featured,
      status: v.status,
      position: v.position,
    },
  };
}

function dbErrorState(error: { code?: string; message: string }): ProductFormState {
  if (error.code === "23505") {
    return {
      ok: false,
      message: "Some fields need attention.",
      fieldErrors: { slug: "Another product already uses that slug. Try a different one." },
    };
  }
  return { ok: false, message: error.message };
}

export async function createProduct(
  _prev: ProductFormState,
  fd: FormData,
): Promise<ProductFormState> {
  await requireAdmin();

  const parsed = parseProduct(fd);
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .insert(parsed.row)
    .select("id")
    .single();

  if (error) return dbErrorState(error);

  revalidateCatalogue();
  redirect(`/admin/products/${data.id}/edit?created=1`);
}

export async function updateProduct(
  _prev: ProductFormState,
  fd: FormData,
): Promise<ProductFormState> {
  await requireAdmin();

  const id = field(fd, "id");
  if (!id) return { ok: false, message: "Missing product id." };

  const parsed = parseProduct(fd);
  if (!parsed.ok) return parsed.state;

  const supabase = await createClient();
  const { error } = await supabase.from("products").update(parsed.row).eq("id", id);
  if (error) return dbErrorState(error);

  revalidateCatalogue();
  revalidatePath(`/admin/products/${id}/edit`);
  return { ok: true, message: "Changes saved." };
}

/**
 * Never delete: `order_items.product_id` is ON DELETE SET NULL, so a delete
 * quietly severs the link between past orders and the product they were for.
 */
export async function setProductStatus(
  id: string,
  status: (typeof PRODUCT_STATUSES)[number],
): Promise<ActionResult> {
  await requireAdmin();

  if (!PRODUCT_STATUSES.includes(status)) return { ok: false, message: "Unknown status." };

  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ status }).eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidateCatalogue();
  revalidatePath(`/admin/products/${id}/edit`);
  return { ok: true, id };
}

/** Finds `slug-copy`, then `slug-copy-2`, … until one is free. */
async function freeSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  base: string,
): Promise<string> {
  for (let n = 1; n <= 50; n += 1) {
    const candidate = n === 1 ? `${base}-copy` : `${base}-copy-${n}`;
    const { data } = await supabase.from("products").select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
  }
  return `${base}-copy-${Date.now()}`;
}

export async function duplicateProduct(id: string): Promise<ActionResult> {
  await requireAdmin();

  const supabase = await createClient();
  const { data: source, error: readError } = await supabase
    .from("products")
    .select(
      "slug, title, description, category_id, price_cents, compare_at_cents, color_name, color_hex, width_cm, stock, low_stock_threshold, position",
    )
    .eq("id", id)
    .single();

  if (readError || !source) return { ok: false, message: readError?.message ?? "Product not found." };

  const slug = await freeSlug(supabase, slugify(source.slug) || "product");
  const { data: created, error: insertError } = await supabase
    .from("products")
    .insert({
      ...source,
      slug,
      title: `${source.title} (Copy)`,
      // A copy is never live and never featured until someone says so.
      status: "draft" as const,
      featured: false,
    })
    .select("id")
    .single();

  if (insertError) return { ok: false, message: insertError.message };

  const { data: images } = await supabase
    .from("product_images")
    .select("url, alt, position, width, height, media_id")
    .eq("product_id", id)
    .order("position", { ascending: true });

  if (images?.length) {
    // Rows only — the copy points at the same storage objects, and
    // deleteProductImage refuses to remove an object another row still uses.
    const { error: imageError } = await supabase
      .from("product_images")
      .insert(images.map((img) => ({ ...img, product_id: created.id })));
    if (imageError) return { ok: false, message: `Product copied, but its images did not: ${imageError.message}` };
  }

  revalidateCatalogue();
  return { ok: true, id: created.id };
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

const imageInputSchema = z.object({
  productId: z.uuid(),
  // Uploads write the bucket's public URL; the seed rows carry site-relative
  // paths. Anything else is rejected before it can reach the CHECK constraint.
  url: z
    .string()
    .trim()
    .max(2048)
    .refine((u) => u.startsWith("https://") || u.startsWith("/") || u.startsWith(`${PRODUCT_IMAGE_BUCKET}/`), {
      message: "Image URL must be an https URL, a site path, or a product-images key.",
    }),
  alt: z.string().trim().min(1, "Alt text is required.").max(300),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export async function addProductImage(input: {
  productId: string;
  url: string;
  alt: string;
  width?: number;
  height?: number;
}): Promise<ActionResult> {
  await requireAdmin();

  const parsed = imageInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid image." };
  const v = parsed.data;

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("product_images")
    .select("position")
    .eq("product_id", v.productId)
    .order("position", { ascending: false })
    .limit(1);

  const position = (last?.[0]?.position ?? -1) + 1;

  const { error } = await supabase.from("product_images").insert({
    product_id: v.productId,
    url: v.url,
    alt: v.alt,
    position,
    width: v.width ?? null,
    height: v.height ?? null,
  });

  if (error) {
    return {
      ok: false,
      message:
        error.code === "23505"
          ? "That image is already attached to this product."
          : error.message,
    };
  }

  revalidateCatalogue();
  revalidatePath(`/admin/products/${v.productId}/edit`);
  return { ok: true };
}

export async function updateProductImageAlt(imageId: string, alt: string): Promise<ActionResult> {
  await requireAdmin();

  const parsed = z.object({ imageId: z.uuid(), alt: z.string().trim().min(1, "Alt text is required.").max(300) })
    .safeParse({ imageId, alt });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid alt text." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_images")
    .update({ alt: parsed.data.alt })
    .eq("id", parsed.data.imageId)
    .select("product_id")
    .single();

  if (error) return { ok: false, message: error.message };

  revalidateCatalogue();
  revalidatePath(`/admin/products/${data.product_id}/edit`);
  return { ok: true };
}

export async function moveProductImage(
  imageId: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  await requireAdmin();

  const supabase = await createClient();
  const { data: image, error: readError } = await supabase
    .from("product_images")
    .select("product_id")
    .eq("id", imageId)
    .single();
  if (readError || !image) return { ok: false, message: readError?.message ?? "Image not found." };

  const { data: siblings, error: listError } = await supabase
    .from("product_images")
    .select("id")
    .eq("product_id", image.product_id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (listError || !siblings) return { ok: false, message: listError?.message ?? "Could not read the gallery." };

  const ids = siblings.map((row) => row.id as string);
  const from = ids.indexOf(imageId);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= ids.length) return { ok: true };

  [ids[from], ids[to]] = [ids[to], ids[from]];

  // Seeded rows can share a position, so rewrite the whole run rather than
  // swapping two values and leaving the ties unresolved.
  const results = await Promise.all(
    ids.map((id, index) => supabase.from("product_images").update({ position: index }).eq("id", id)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, message: failed.error.message };

  revalidateCatalogue();
  revalidatePath(`/admin/products/${image.product_id}/edit`);
  return { ok: true };
}

export async function deleteProductImage(imageId: string): Promise<ActionResult> {
  await requireAdmin();

  const supabase = await createClient();
  const { data: image, error: readError } = await supabase
    .from("product_images")
    .select("product_id, url")
    .eq("id", imageId)
    .single();
  if (readError || !image) return { ok: false, message: readError?.message ?? "Image not found." };

  const key = productImageStorageKey(image.url);
  if (key) {
    // A duplicated product reuses the same object, so only bin the file once
    // the last row referencing it is going away.
    const { count } = await supabase
      .from("product_images")
      .select("id", { count: "exact", head: true })
      .eq("url", image.url)
      .neq("id", imageId);

    if (!count) {
      const { error: storageError } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([key]);
      if (storageError) return { ok: false, message: `Could not remove the file: ${storageError.message}` };
    }
  }

  const { error } = await supabase.from("product_images").delete().eq("id", imageId);
  if (error) return { ok: false, message: error.message };

  revalidateCatalogue();
  revalidatePath(`/admin/products/${image.product_id}/edit`);
  return { ok: true };
}
