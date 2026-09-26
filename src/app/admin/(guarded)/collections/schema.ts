import { z } from "zod";
import {
  IMAGE_URL_HINT,
  SLUG_PATTERN,
  isSafeAssetUrl,
} from "@/app/admin/(guarded)/categories/schema";
import { RESERVED_SLUG_MESSAGE, isReservedCollectionSlug } from "@/lib/reserved-slugs";

/**
 * Shared between the server actions and the client form so the admin sees the
 * same message the database would have raised, before it raises it.
 * Every rule here mirrors a constraint in 0013_collections.sql. The slug rule
 * and the asset-URL check are the categories' own, because the two tables
 * share the /collections/<slug> namespace and the same image storage — and so
 * the same reserved slugs, which next.config.ts redirects away.
 */

export { IMAGE_URL_HINT, SLUG_PATTERN };

export const collectionInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the collection a name")
    .max(80, "Keep the name to 80 characters or fewer"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "The slug needs at least 2 characters")
    .max(64, "Keep the slug to 64 characters or fewer")
    .regex(new RegExp(SLUG_PATTERN), "Lowercase letters, numbers and single hyphens only — no spaces")
    .refine((slug) => !isReservedCollectionSlug(slug), RESERVED_SLUG_MESSAGE),
  description: z
    .string()
    .trim()
    .max(500, "Keep the description to 500 characters or fewer"),
  heroEyebrow: z
    .string()
    .trim()
    .max(60, "Keep the eyebrow to 60 characters or fewer"),
  position: z.coerce
    .number({ error: "Position must be a whole number" })
    .int("Position must be a whole number")
    .min(0, "Position cannot be negative")
    .max(9999, "Position must be 9999 or lower"),
  isActive: z.boolean(),
  imageUrl: z
    .string()
    .trim()
    .max(2048, "That address is too long")
    .refine(isSafeAssetUrl, IMAGE_URL_HINT),
});

export type CollectionInput = z.infer<typeof collectionInputSchema>;
export type CollectionField = keyof CollectionInput;

export type CollectionFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<CollectionField, string>>;
};

export const EMPTY_FORM_STATE: CollectionFormState = { status: "idle" };

/** Result of the small imperative actions driven from row buttons. */
export type ActionResult = { ok: true } | { ok: false; message: string };

/** Adding members reports how many actually went in, so duplicates are explained. */
export type AddMembersResult =
  | { ok: true; added: number; skipped: number }
  | { ok: false; message: string };
