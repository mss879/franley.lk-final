"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/admin-guard";
import {
  collectionInputSchema,
  type ActionResult,
  type AddMembersResult,
  type CollectionField,
  type CollectionFormState,
} from "./schema";

/**
 * A Server Action is a public POST endpoint. The admin layout calling
 * requireAdmin() gates the *render*, not the request, so every action below
 * re-checks before it touches a row.
 */

/**
 * The footer lists collections on every page, so the storefront is purged
 * from the root layout — which also covers /collections and each collection
 * page. (A `/collections/[slug]` page pattern would miss them anyway:
 * revalidatePath matches the route's file path, and they sit under `(shop)`.)
 */
function revalidateStorefront() {
  revalidatePath("/admin/collections");
  revalidatePath("/", "layout");
}

const idSchema = z.uuid();
const isId = (value: string) => idSchema.safeParse(value).success;

type DbError = { code?: string; message?: string; details?: string | null };

/** Turn a PostgREST/Postgres failure into something an admin can act on. */
function describeDbError(error: DbError): string {
  switch (error.code) {
    case "23505":
      // tg_collections_slug_free raises 23505 with this wording when a
      // category already owns the address; a plain unique violation is
      // another collection.
      return error.message?.includes("already uses the slug")
        ? "A category already uses that slug. Categories and collections share /collections/…, so pick another."
        : "That slug is already taken by another collection. Try a different one.";
    case "23503":
      return "That product or collection no longer exists. Reload the page and try again.";
    case "23514":
      return "The database rejected one of these values. Check the slug, the description length and the image address.";
    case "42501":
      return "Your account is not allowed to change collections.";
    default:
      return error.message?.trim() || "Something went wrong saving that. Try again.";
  }
}

function fieldError(field: CollectionField, message: string): CollectionFormState {
  return { status: "error", fieldErrors: { [field]: message } };
}

function readForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    description: String(formData.get("description") ?? ""),
    heroEyebrow: String(formData.get("heroEyebrow") ?? ""),
    position: String(formData.get("position") ?? "0"),
    isActive: formData.get("isActive") === "on",
    imageUrl: String(formData.get("imageUrl") ?? ""),
  };
}

function parse(formData: FormData):
  | { ok: true; value: ReturnType<typeof collectionInputSchema.parse> }
  | { ok: false; state: CollectionFormState } {
  const result = collectionInputSchema.safeParse(readForm(formData));
  if (result.success) return { ok: true, value: result.data };

  const fieldErrors: Partial<Record<CollectionField, string>> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as CollectionField | undefined;
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return {
    ok: false,
    state: { status: "error", message: "Fix the highlighted fields and save again.", fieldErrors },
  };
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Both tables answer to /collections/<slug>, and the storefront resolves a
 * collection before a category — so a clash would silently hide the category.
 * The database trigger refuses it too; asking first gives a field-level message.
 */
async function slugTakenByCategory(supabase: Supabase, slug: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("categories")
    .select("name")
    .eq("slug", slug)
    .maybeSingle();
  if (error) return null;
  return data ? `That slug is used by the “${data.name}” category. Categories and collections share /collections/…, so pick another.` : null;
}

function toDbRow(input: ReturnType<typeof collectionInputSchema.parse>) {
  return {
    name: input.name,
    slug: input.slug,
    description: input.description || null,
    hero_eyebrow: input.heroEyebrow || null,
    position: input.position,
    is_active: input.isActive,
    image_url: input.imageUrl || null,
  };
}

export async function createCollection(
  _prev: CollectionFormState,
  formData: FormData,
): Promise<CollectionFormState> {
  await requireAdmin();

  const parsed = parse(formData);
  if (!parsed.ok) return parsed.state;
  const input = parsed.value;

  const supabase = await createClient();
  const clash = await slugTakenByCategory(supabase, input.slug);
  if (clash) return fieldError("slug", clash);

  const { error } = await supabase.from("collections").insert(toDbRow(input));

  if (error) {
    if (error.code === "23505") return fieldError("slug", describeDbError(error));
    return { status: "error", message: describeDbError(error) };
  }

  revalidateStorefront();
  redirect(`/admin/collections?saved=${encodeURIComponent(input.name)}`);
}

export async function updateCollection(
  _prev: CollectionFormState,
  formData: FormData,
): Promise<CollectionFormState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!isId(id)) {
    return { status: "error", message: "This form lost track of which collection it edits. Reload the page." };
  }

  const parsed = parse(formData);
  if (!parsed.ok) return parsed.state;
  const input = parsed.value;

  const supabase = await createClient();
  const clash = await slugTakenByCategory(supabase, input.slug);
  if (clash) return fieldError("slug", clash);

  const { error } = await supabase.from("collections").update(toDbRow(input)).eq("id", id);

  if (error) {
    if (error.code === "23505") return fieldError("slug", describeDbError(error));
    return { status: "error", message: describeDbError(error) };
  }

  revalidateStorefront();
  redirect(`/admin/collections?saved=${encodeURIComponent(input.name)}`);
}

export async function setCollectionActive(id: string, isActive: boolean): Promise<ActionResult> {
  await requireAdmin();

  if (!isId(id)) return { ok: false, message: "That collection id is not valid. Reload the page." };

  const supabase = await createClient();
  const { error } = await supabase.from("collections").update({ is_active: isActive }).eq("id", id);
  if (error) return { ok: false, message: describeDbError(error) };

  revalidateStorefront();
  return { ok: true };
}

/**
 * Swap a collection with its neighbour. Positions are rewritten as a dense
 * 0..n-1 run first, so a list seeded with duplicate or sparse positions
 * settles into a predictable order after one nudge.
 */
export async function moveCollection(id: string, direction: "up" | "down"): Promise<ActionResult> {
  await requireAdmin();

  if (!isId(id)) return { ok: false, message: "That collection id is not valid. Reload the page." };

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("collections")
    .select("id, position, name")
    .order("position", { ascending: true })
    .order("name", { ascending: true });

  if (error) return { ok: false, message: describeDbError(error) };

  const ordered = (rows ?? []).slice();
  const index = ordered.findIndex((row) => row.id === id);
  if (index < 0) return { ok: false, message: "That collection no longer exists. Reload the page." };

  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= ordered.length) return { ok: true };

  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];

  const writes = ordered
    .map((row, i) => ({ row, i }))
    .filter(({ row, i }) => row.position !== i)
    .map(({ row, i }) => supabase.from("collections").update({ position: i }).eq("id", row.id));

  const results = await Promise.all(writes);
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, message: describeDbError(failed.error) };

  revalidateStorefront();
  return { ok: true };
}

/**
 * collection_products cascades, so deleting takes the memberships with it —
 * the products themselves are untouched. The row button confirms first.
 */
export async function deleteCollection(id: string): Promise<ActionResult> {
  await requireAdmin();

  if (!isId(id)) return { ok: false, message: "That collection id is not valid. Reload the page." };

  const supabase = await createClient();
  const { error } = await supabase.from("collections").delete().eq("id", id);
  if (error) return { ok: false, message: describeDbError(error) };

  revalidateStorefront();
  return { ok: true };
}

/** Sanity cap: the catalogue is a few dozen rows, so anything larger is a bug. */
const MAX_BATCH = 500;

/**
 * Append products after the current last member. Products already in the
 * collection keep their place, and are reported back as skipped rather than
 * failing the whole batch.
 */
export async function addProductsToCollection(
  collectionId: string,
  productIds: string[],
): Promise<AddMembersResult> {
  await requireAdmin();

  if (!isId(collectionId)) return { ok: false, message: "That collection id is not valid. Reload the page." };
  const wanted = [...new Set(productIds)].filter(isId);
  if (wanted.length === 0) return { ok: false, message: "Tick at least one product to add." };
  if (wanted.length > MAX_BATCH) return { ok: false, message: `Add at most ${MAX_BATCH} products at a time.` };

  const supabase = await createClient();
  const { data: existing, error } = await supabase
    .from("collection_products")
    .select("product_id, position")
    .eq("collection_id", collectionId);
  if (error) return { ok: false, message: describeDbError(error) };

  const members = (existing ?? []) as { product_id: string; position: number }[];
  const already = new Set(members.map((m) => m.product_id));
  const fresh = wanted.filter((id) => !already.has(id));
  if (fresh.length === 0) {
    return { ok: true, added: 0, skipped: wanted.length };
  }

  const start = members.length ? Math.max(...members.map((m) => m.position)) + 1 : 0;
  const rows = fresh.map((product_id, i) => ({
    collection_id: collectionId,
    product_id,
    position: start + i,
  }));

  // ON CONFLICT DO NOTHING, in case a product was added from another tab
  // between the read above and this write.
  const { error: writeError } = await supabase
    .from("collection_products")
    .upsert(rows, { onConflict: "collection_id,product_id", ignoreDuplicates: true });
  if (writeError) return { ok: false, message: describeDbError(writeError) };

  revalidateStorefront();
  return { ok: true, added: fresh.length, skipped: wanted.length - fresh.length };
}

export async function removeProductFromCollection(
  collectionId: string,
  productId: string,
): Promise<ActionResult> {
  await requireAdmin();

  if (!isId(collectionId) || !isId(productId)) {
    return { ok: false, message: "That product or collection id is not valid. Reload the page." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("collection_products")
    .delete()
    .eq("collection_id", collectionId)
    .eq("product_id", productId);
  if (error) return { ok: false, message: describeDbError(error) };

  revalidateStorefront();
  return { ok: true };
}

/** Same dense-renumber swap as moveCollection, inside one collection's members. */
export async function moveCollectionProduct(
  collectionId: string,
  productId: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  await requireAdmin();

  if (!isId(collectionId) || !isId(productId)) {
    return { ok: false, message: "That product or collection id is not valid. Reload the page." };
  }

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("collection_products")
    .select("product_id, position")
    .eq("collection_id", collectionId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return { ok: false, message: describeDbError(error) };

  const ordered = ((rows ?? []) as { product_id: string; position: number }[]).slice();
  const index = ordered.findIndex((row) => row.product_id === productId);
  if (index < 0) return { ok: false, message: "That product is no longer in this collection. Reload the page." };

  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= ordered.length) return { ok: true };

  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];

  const writes = ordered
    .map((row, i) => ({ row, i }))
    .filter(({ row, i }) => row.position !== i)
    .map(({ row, i }) =>
      supabase
        .from("collection_products")
        .update({ position: i })
        .eq("collection_id", collectionId)
        .eq("product_id", row.product_id),
    );

  const results = await Promise.all(writes);
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, message: describeDbError(failed.error) };

  revalidateStorefront();
  return { ok: true };
}
