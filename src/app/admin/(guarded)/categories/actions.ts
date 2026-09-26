"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/admin-guard";
import {
  categoryInputSchema,
  type ActionResult,
  type CategoryField,
  type CategoryFormState,
} from "./schema";

/**
 * A Server Action is a public POST endpoint. The admin layout calling
 * requireAdmin() gates the *render*, not the request, so every action below
 * re-checks before it touches a row.
 */

/**
 * Category names and counts reach every storefront page (header, footer,
 * filter pills, product eyebrows), so the whole tree is purged from the root
 * layout, as the products and collections actions do. A dynamic pattern such
 * as `/collections/[slug]` would not do it on its own: revalidatePath matches
 * the route's file path, and these pages live under the `(shop)` group.
 */
function revalidateStorefront() {
  revalidatePath("/admin/categories");
  revalidatePath("/", "layout");
}

const idSchema = z.uuid();
const isId = (value: string) => idSchema.safeParse(value).success;

type DbError = { code?: string; message?: string; details?: string | null };

/** Turn a PostgREST/Postgres failure into something an admin can act on. */
function describeDbError(error: DbError, subject = "category"): string {
  switch (error.code) {
    case "23505":
      // tg_categories_slug_free (0013) raises 23505 with this wording when a
      // collection already owns the address, since both share /collections/<slug>.
      return error.message?.includes("already uses the slug")
        ? "That slug is used by a collection. Categories and collections share /collections/…, so pick another."
        : "That slug is already taken by another category. Try a different one.";
    case "23503":
      return `This ${subject} is still referenced by other rows, so the database refused the change. Move what points at it first.`;
    case "23514":
      if (error.message?.includes("must stay top level")) {
        return "This category has sub-categories of its own, so it has to stay top level. Move its children out first.";
      }
      return (
        error.message?.includes("circular") || error.message?.includes("two levels")
          ? "Categories may only nest two levels deep, and a category cannot sit inside its own branch."
          : "The database rejected one of these values. Check the slug, the description length and the image address."
      );
    case "42501":
      return "Your account is not allowed to change categories.";
    default:
      return error.message?.trim() || "Something went wrong saving that. Try again.";
  }
}

function fieldError(field: CategoryField, message: string): CategoryFormState {
  return { status: "error", fieldErrors: { [field]: message } };
}

function readForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    description: String(formData.get("description") ?? ""),
    parentId: String(formData.get("parentId") ?? ""),
    position: String(formData.get("position") ?? "0"),
    isActive: formData.get("isActive") === "on",
    imageUrl: String(formData.get("imageUrl") ?? ""),
  };
}

function parse(formData: FormData):
  | { ok: true; value: ReturnType<typeof categoryInputSchema.parse> }
  | { ok: false; state: CategoryFormState } {
  const result = categoryInputSchema.safeParse(readForm(formData));
  if (result.success) return { ok: true, value: result.data };

  const fieldErrors: Partial<Record<CategoryField, string>> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as CategoryField | undefined;
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return {
    ok: false,
    state: { status: "error", message: "Fix the highlighted fields and save again.", fieldErrors },
  };
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Curated collections answer to the same /collections/<slug> address, and the
 * storefront resolves a collection before a category — so a clash would
 * silently hide this category. The database trigger refuses it too; asking
 * first gives a field-level message instead of a bare unique violation.
 */
async function slugTakenByCollection(supabase: Supabase, slug: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("collections")
    .select("name")
    .eq("slug", slug)
    .maybeSingle();
  // Before 0013 is applied the table does not exist; the trigger will not
  // exist either, so there is nothing to clash with.
  if (error || !data) return null;
  return `That slug is used by the “${data.name}” collection. Categories and collections share /collections/…, so pick another.`;
}

/**
 * The DB trigger only walks *upwards*, so it catches a category adopting its
 * own ancestor but not a parent-of-children being demoted — which would leave
 * grandchildren three levels deep. Both are settled here, before the write.
 */
async function assertParentAllowed(
  supabase: Supabase,
  parentId: string,
  selfId: string | null,
): Promise<string | null> {
  if (!parentId) return null;
  if (selfId && parentId === selfId) return "A category cannot be its own parent.";

  const { data: parent, error } = await supabase
    .from("categories")
    .select("id, name, parent_id")
    .eq("id", parentId)
    .maybeSingle();

  if (error) return describeDbError(error);
  if (!parent) return "That parent category no longer exists. Reload the page.";
  if (parent.parent_id) {
    return `“${parent.name}” is already a sub-category. Categories only nest two levels deep.`;
  }

  if (selfId) {
    const { count } = await supabase
      .from("categories")
      .select("id", { count: "exact", head: true })
      .eq("parent_id", selfId);
    if ((count ?? 0) > 0) {
      return "This category has sub-categories of its own, so it has to stay top level. Move its children out first.";
    }
  }
  return null;
}

export async function createCategory(
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  await requireAdmin();

  const parsed = parse(formData);
  if (!parsed.ok) return parsed.state;
  const input = parsed.value;

  const supabase = await createClient();
  const slugClash = await slugTakenByCollection(supabase, input.slug);
  if (slugClash) return fieldError("slug", slugClash);

  const parentProblem = await assertParentAllowed(supabase, input.parentId, null);
  if (parentProblem) return fieldError("parentId", parentProblem);

  const { error } = await supabase.from("categories").insert({
    name: input.name,
    slug: input.slug,
    description: input.description || null,
    parent_id: input.parentId || null,
    position: input.position,
    is_active: input.isActive,
    image_url: input.imageUrl || null,
  });

  if (error) {
    if (error.code === "23505") return fieldError("slug", describeDbError(error));
    return { status: "error", message: describeDbError(error) };
  }

  revalidateStorefront();
  redirect(`/admin/categories?saved=${encodeURIComponent(input.name)}`);
}

export async function updateCategory(
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!isId(id)) {
    return { status: "error", message: "This form lost track of which category it edits. Reload the page." };
  }

  const parsed = parse(formData);
  if (!parsed.ok) return parsed.state;
  const input = parsed.value;

  const supabase = await createClient();
  const slugClash = await slugTakenByCollection(supabase, input.slug);
  if (slugClash) return fieldError("slug", slugClash);

  const parentProblem = await assertParentAllowed(supabase, input.parentId, id);
  if (parentProblem) return fieldError("parentId", parentProblem);

  const { error } = await supabase
    .from("categories")
    .update({
      name: input.name,
      slug: input.slug,
      description: input.description || null,
      parent_id: input.parentId || null,
      position: input.position,
      is_active: input.isActive,
      image_url: input.imageUrl || null,
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") return fieldError("slug", describeDbError(error));
    return { status: "error", message: describeDbError(error) };
  }

  revalidateStorefront();
  redirect(`/admin/categories?saved=${encodeURIComponent(input.name)}`);
}

export async function setCategoryActive(id: string, isActive: boolean): Promise<ActionResult> {
  await requireAdmin();

  if (!isId(id)) return { ok: false, message: "That category id is not valid. Reload the page." };

  const supabase = await createClient();
  const { error } = await supabase.from("categories").update({ is_active: isActive }).eq("id", id);
  if (error) return { ok: false, message: describeDbError(error) };

  revalidateStorefront();
  return { ok: true };
}

/**
 * Swap a category with its neighbour inside the same level. Positions are
 * rewritten as a dense 0..n-1 run first, so a tree seeded with duplicate or
 * sparse positions settles into a predictable order after one nudge.
 */
export async function moveCategory(id: string, direction: "up" | "down"): Promise<ActionResult> {
  await requireAdmin();

  if (!isId(id)) return { ok: false, message: "That category id is not valid. Reload the page." };

  const supabase = await createClient();
  const { data: self, error: selfError } = await supabase
    .from("categories")
    .select("id, parent_id")
    .eq("id", id)
    .maybeSingle();

  if (selfError) return { ok: false, message: describeDbError(selfError) };
  if (!self) return { ok: false, message: "That category no longer exists. Reload the page." };

  const siblingQuery = supabase.from("categories").select("id, position, name");
  const { data: siblings, error: siblingError } = await (
    self.parent_id ? siblingQuery.eq("parent_id", self.parent_id) : siblingQuery.is("parent_id", null)
  )
    .order("position", { ascending: true })
    .order("name", { ascending: true });

  if (siblingError) return { ok: false, message: describeDbError(siblingError) };

  const ordered = (siblings ?? []).slice();
  const index = ordered.findIndex((row) => row.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= ordered.length) return { ok: true };

  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];

  const writes = ordered
    .map((row, i) => ({ row, i }))
    .filter(({ row, i }) => row.position !== i)
    .map(({ row, i }) => supabase.from("categories").update({ position: i }).eq("id", row.id));

  const results = await Promise.all(writes);
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, message: describeDbError(failed.error) };

  revalidateStorefront();
  return { ok: true };
}

/**
 * parent_id and products.category_id are both ON DELETE RESTRICT, so the
 * database would answer with a raw 23503. Ask first, and name exactly what has
 * to move.
 */
export async function deleteCategory(id: string): Promise<ActionResult> {
  await requireAdmin();

  if (!isId(id)) return { ok: false, message: "That category id is not valid. Reload the page." };

  const supabase = await createClient();

  const { data: category } = await supabase
    .from("categories")
    .select("name")
    .eq("id", id)
    .maybeSingle();
  const label = category?.name ?? "That category";

  const [children, products] = await Promise.all([
    supabase.from("categories").select("name", { count: "exact" }).eq("parent_id", id).limit(5),
    supabase.from("products").select("title", { count: "exact" }).eq("category_id", id).limit(3),
  ]);

  const childCount = children.count ?? 0;
  if (childCount > 0) {
    const names = (children.data ?? []).map((c) => c.name).join(", ");
    return {
      ok: false,
      message:
        `“${label}” still has ${childCount} sub-categor${childCount === 1 ? "y" : "ies"} (${names}). ` +
        "Give them a different parent — or delete them — before deleting this one.",
    };
  }

  const productCount = products.count ?? 0;
  if (productCount > 0) {
    const shown = (products.data ?? []).map((p) => p.title);
    const rest = productCount - shown.length;
    const list = shown.join(", ") + (rest > 0 ? ` and ${rest} more` : "");
    return {
      ok: false,
      message:
        `“${label}” still holds ${productCount} product${productCount === 1 ? "" : "s"} (${list}). ` +
        "Move them into another category first — you can do that from this category’s edit page.",
    };
  }

  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) {
    // Belt and braces: something could have been assigned between the checks
    // above and this delete.
    if (error.code === "23503") {
      return {
        ok: false,
        message: `“${label}” was assigned something while you were looking at this page. Reload and check again.`,
      };
    }
    return { ok: false, message: describeDbError(error) };
  }

  revalidateStorefront();
  return { ok: true };
}

/** Reassign a single product from a category's edit page. */
export async function moveProductToCategory(
  productId: string,
  categoryId: string,
): Promise<ActionResult> {
  await requireAdmin();

  if (!categoryId) return { ok: false, message: "Choose a category to move this product into." };
  if (!isId(productId) || !isId(categoryId)) {
    return { ok: false, message: "That product or category id is not valid. Reload the page." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ category_id: categoryId })
    .eq("id", productId);

  if (error) return { ok: false, message: describeDbError(error, "product") };

  // revalidateStorefront() purges the root layout, product pages included.
  revalidateStorefront();
  revalidatePath("/admin/products");
  return { ok: true };
}
