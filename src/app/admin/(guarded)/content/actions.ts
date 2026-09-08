"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/admin-guard";
import { createClient } from "@/lib/supabase/server";
import {
  ROOT_FIELD,
  parseFields,
  setAtPath,
  type ActionState,
  type FieldDescriptor,
} from "@/components/admin/content/types";
import { ACCEPTED_MIME, MAX_UPLOAD_BYTES, MEDIA_FOLDERS } from "@/components/admin/content/media";

/* ------------------------------------------------------------------ helpers */

// Mirrors public.is_safe_link_href / public.is_safe_asset_url from
// 0001_init_extensions.sql. The database is the authority; failing here first
// just turns a constraint violation into a sentence the client can act on.
const SAFE_LINK = /^(https:\/\/|\/)/;
const SAFE_ASSET = /^(https:\/\/|\/|product-images\/|cms-media\/)/;
const UNSAFE_SCHEME = /^\s*(javascript|data|vbscript):/i;

const PAYLOAD_BYTE_LIMIT = 30_000; // the column check is 32768; leave headroom

function fail(message: string, fieldErrors?: Record<string, string>): ActionState {
  return { ok: false, message, fieldErrors };
}

function firstIssue(result: z.ZodSafeParseResult<unknown>) {
  return result.success ? "" : (result.error.issues[0]?.message ?? "That value is not valid.");
}

const uuid = z.uuid();

/** A zod schema for one field descriptor, so every value is checked by its declared type. */
function schemaForField(field: FieldDescriptor): z.ZodType {
  const label = field.label;

  switch (field.type) {
    case "boolean":
      return z.boolean();

    case "number": {
      const base = z.number().finite();
      return field.required ? base : base.nullable();
    }

    case "select": {
      const allowed = field.options.map((o) => o.value);
      const base = z.string().refine((v) => allowed.includes(v), `Pick one of the listed options.`);
      return field.required ? base : z.union([z.literal(""), base]);
    }

    case "string_list": {
      const item = z
        .string()
        .min(1)
        .max(field.maxLength ?? 200, `Each line in ${label} is limited to ${field.maxLength ?? 200} characters.`);
      const list = z.array(item).max(field.maxItems ?? 24, `${label} allows at most ${field.maxItems ?? 24} lines.`);
      return field.required ? list.min(1, `${label} needs at least one line.`) : list;
    }

    case "image":
    case "media": {
      const base = z
        .string()
        .max(2048)
        .refine((v) => SAFE_ASSET.test(v) && !UNSAFE_SCHEME.test(v),
          `${label} must be an address starting with / or https://.`);
      return field.required
        ? base.refine((v) => v.length > 0, `${label} is required.`)
        : z.union([z.literal(""), base]);
    }

    case "url":
    case "link": {
      const base = z
        .string()
        .max(2048)
        .refine((v) => SAFE_LINK.test(v) && !UNSAFE_SCHEME.test(v),
          `${label} must start with / for a page on this site, or https:// for an external link.`);
      return field.required
        ? base.refine((v) => v.length > 0, `${label} is required.`)
        : z.union([z.literal(""), base]);
    }

    default: {
      let base = z.string().max(field.maxLength ?? 4000, `${label} is limited to ${field.maxLength ?? 4000} characters.`);
      if (field.required) base = base.min(1, `${label} is required.`);
      return base;
    }
  }
}

/** Turns the raw form value into the JSON shape the payload stores. */
function readSubmitted(field: FieldDescriptor, formData: FormData): unknown {
  const raw = formData.get(`f:${field.name}`);

  if (field.type === "boolean") return raw !== null;

  const text = typeof raw === "string" ? raw : "";

  if (field.type === "string_list") {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }
  if (field.type === "number") {
    const trimmed = text.trim();
    if (trimmed === "") return field.required ? Number.NaN : null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : Number.NaN;
  }
  return text.trim();
}

function parseInstant(raw: FormDataEntryValue | null): string | null | "invalid" {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? "invalid" : d.toISOString();
}

/* --------------------------------------------------------- content blocks */

export async function updateContentBlock(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return fail("That content block could not be identified.");

  const supabase = await createClient();

  // The field schema and the untouched payload come from the database, never
  // from the form — otherwise a tampered request could rewrite either.
  const { data: block, error: readError } = await supabase
    .from("content_blocks")
    .select("id, page, key, payload, fields, is_locked")
    .eq("id", id.data)
    .maybeSingle();

  if (readError || !block) return fail("That content block no longer exists.");

  const fields = parseFields(block.fields);
  if (fields.length === 0) return fail("This block has no editable fields.");

  const fieldErrors: Record<string, string> = {};
  const accepted: Record<string, unknown> = {};

  for (const field of fields) {
    const value = readSubmitted(field, formData);
    const result = schemaForField(field).safeParse(value);
    if (!result.success) {
      fieldErrors[field.name] = firstIssue(result);
      continue;
    }
    accepted[field.name] = result.data;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return fail("Some fields need attention before this can be saved.", fieldErrors);
  }

  // Build the new payload. Keys the form did not render ride along untouched.
  let payload: unknown;
  if (fields.some((f) => f.name === ROOT_FIELD)) {
    payload = accepted[ROOT_FIELD];
  } else {
    let next: Record<string, unknown> =
      block.payload && typeof block.payload === "object" && !Array.isArray(block.payload)
        ? { ...(block.payload as Record<string, unknown>) }
        : {};
    for (const field of fields) next = setAtPath(next, field.name, accepted[field.name]);
    payload = next;
  }

  if (JSON.stringify(payload).length > PAYLOAD_BYTE_LIMIT) {
    return fail("There is too much content in this block. Shorten the longest fields.");
  }

  const publishAt = parseInstant(formData.get("publish_at"));
  const unpublishAt = parseInstant(formData.get("unpublish_at"));
  if (publishAt === "invalid" || unpublishAt === "invalid") {
    return fail("One of the schedule dates could not be read.");
  }
  if (publishAt && unpublishAt && new Date(unpublishAt) <= new Date(publishAt)) {
    return fail("The end date has to come after the start date.");
  }

  const { error } = await supabase
    .from("content_blocks")
    .update({
      payload,
      published: formData.get("published") !== null,
      publish_at: publishAt,
      unpublish_at: unpublishAt,
    })
    .eq("id", id.data);

  if (error) {
    return fail(
      error.message.includes("is locked")
        ? "This block's layout is fixed and cannot be changed from here."
        : `Could not save: ${error.message}`,
    );
  }

  revalidatePath("/", "layout");
  revalidatePath("/admin/content");
  revalidatePath(`/admin/content/${id.data}`);
  return { ok: true, message: "Saved. The storefront is updated." };
}

/** The published switch on the list page. */
export async function setBlockPublished(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = z
    .object({ id: uuid, published: z.enum(["true", "false"]) })
    .safeParse({ id: formData.get("id"), published: formData.get("published") });

  if (!parsed.success) return fail("That content block could not be identified.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("content_blocks")
    .update({ published: parsed.data.published === "true" })
    .eq("id", parsed.data.id);

  if (error) return fail(`Could not update: ${error.message}`);

  revalidatePath("/", "layout");
  revalidatePath("/admin/content");
  return {
    ok: true,
    message: parsed.data.published === "true" ? "Now showing on the site." : "Hidden from the site.",
  };
}

/* ------------------------------------------------------------ media assets */

const FOLDER_VALUES = MEDIA_FOLDERS.map((f) => f.value) as [string, ...string[]];

const mediaMeta = z
  .object({
    alt: z.string().max(400).default(""),
    is_decorative: z.boolean(),
    title: z.string().max(200).default(""),
    folder: z.enum(FOLDER_VALUES),
  })
  // Mirrors the media_assets_alt_required check constraint.
  .refine((v) => v.is_decorative || v.alt.trim().length > 0, {
    message: "Describe the image, or tick “decorative”.",
    path: ["alt"],
  });

const uploadedFile = z.object({
  storage_path: z
    .string()
    .regex(/^cms\/[0-9a-zA-Z._-]{1,120}\.(webp|jpe?g|png|avif)$/, "That upload path is not allowed."),
  mime_type: z.enum(ACCEPTED_MIME as unknown as [string, ...string[]]),
  width: z.coerce.number().int().positive().max(20000),
  height: z.coerce.number().int().positive().max(20000),
  byte_size: z.coerce.number().int().positive().max(MAX_UPLOAD_BYTES),
});

function readMediaMeta(formData: FormData) {
  return mediaMeta.safeParse({
    alt: (formData.get("alt") as string | null)?.trim() ?? "",
    is_decorative: formData.get("is_decorative") !== null,
    title: (formData.get("title") as string | null)?.trim() ?? "",
    folder: formData.get("folder") ?? "general",
  });
}

/**
 * Records a file the browser has already put in the cms-media bucket. The
 * upload itself is client-side so the image bytes never pass through the
 * Next.js server; this is only the registry row.
 */
export async function createMediaAsset(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const meta = readMediaMeta(formData);
  if (!meta.success) {
    return fail(firstIssue(meta), { alt: firstIssue(meta) });
  }

  const file = uploadedFile.safeParse({
    storage_path: formData.get("storage_path"),
    mime_type: formData.get("mime_type"),
    width: formData.get("width"),
    height: formData.get("height"),
    byte_size: formData.get("byte_size"),
  });
  if (!file.success) return fail(firstIssue(file));

  const supabase = await createClient();
  const { error } = await supabase.from("media_assets").insert({
    bucket: "cms-media",
    storage_path: file.data.storage_path,
    mime_type: file.data.mime_type,
    width: file.data.width,
    height: file.data.height,
    byte_size: file.data.byte_size,
    alt: meta.data.alt,
    is_decorative: meta.data.is_decorative,
    title: meta.data.title || null,
    folder: meta.data.folder,
  });

  if (error) return fail(`Could not save the image: ${error.message}`);

  revalidatePath("/admin/content/media");
  return { ok: true, message: "Image added to the library." };
}

export async function updateMediaAsset(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return fail("That image could not be identified.");

  const meta = readMediaMeta(formData);
  if (!meta.success) return fail(firstIssue(meta), { alt: firstIssue(meta) });

  const supabase = await createClient();
  const { error } = await supabase
    .from("media_assets")
    .update({
      alt: meta.data.alt,
      is_decorative: meta.data.is_decorative,
      title: meta.data.title || null,
      folder: meta.data.folder,
    })
    .eq("id", id.data);

  if (error) return fail(`Could not save: ${error.message}`);

  revalidatePath("/admin/content/media");
  return { ok: true, message: "Image details saved." };
}

/**
 * Points an existing library row at a newly uploaded object. Every page using
 * the old address keeps working, because the address is composed from the row.
 */
export async function replaceMediaFile(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return fail("That image could not be identified.");

  const file = uploadedFile.safeParse({
    storage_path: formData.get("storage_path"),
    mime_type: formData.get("mime_type"),
    width: formData.get("width"),
    height: formData.get("height"),
    byte_size: formData.get("byte_size"),
  });
  if (!file.success) return fail(firstIssue(file));

  const supabase = await createClient();
  const { error } = await supabase
    .from("media_assets")
    .update({
      bucket: "cms-media",
      storage_path: file.data.storage_path,
      external_url: null,
      mime_type: file.data.mime_type,
      width: file.data.width,
      height: file.data.height,
      byte_size: file.data.byte_size,
    })
    .eq("id", id.data);

  if (error) return fail(`Could not replace the file: ${error.message}`);

  revalidatePath("/admin/content/media");
  revalidatePath("/", "layout");
  return { ok: true, message: "File replaced." };
}

/**
 * Soft delete. The stored object is deliberately left in place: a page that
 * still references its address keeps rendering, and the row can be restored.
 */
export async function setMediaDeleted(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = z
    .object({ id: uuid, deleted: z.enum(["true", "false"]) })
    .safeParse({ id: formData.get("id"), deleted: formData.get("deleted") });

  if (!parsed.success) return fail("That image could not be identified.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("media_assets")
    .update({ deleted_at: parsed.data.deleted === "true" ? new Date().toISOString() : null })
    .eq("id", parsed.data.id);

  if (error) return fail(`Could not update: ${error.message}`);

  revalidatePath("/admin/content/media");
  return {
    ok: true,
    message: parsed.data.deleted === "true" ? "Removed from the library." : "Restored.",
  };
}
