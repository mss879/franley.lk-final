import { z } from "zod";
import { RESERVED_SLUG_MESSAGE, isReservedCollectionSlug } from "@/lib/reserved-slugs";

/**
 * Shared between the server actions and the client form so the admin sees the
 * same message the database would have raised, before it raises it.
 * Every rule here mirrors a constraint in 0003_catalog.sql / 0001_init_extensions.sql,
 * except the reserved-slug rule, which mirrors the redirects in next.config.ts.
 */

/** categories.slug CHECK: `^[a-z0-9]+(-[a-z0-9]+)*$`, length 2–64. */
export const SLUG_PATTERN = "^[a-z0-9]+(-[a-z0-9]+)*$";
const SLUG_RE = new RegExp(SLUG_PATTERN);

/** Mirrors public.is_safe_asset_url(text). An empty value means "no image". */
export function isSafeAssetUrl(url: string): boolean {
  const value = url.trim();
  if (!value) return true;
  if (value.length > 2048) return false;
  if (/^[\s]*(javascript|data|vbscript):/i.test(value)) return false;
  // "//host" and "/\host" point off-site; a root-relative path is "/" plus anything else.
  return /^(https:\/\/|\/(?![/\\])|product-images\/|cms-media\/)/.test(value);
}

export const IMAGE_URL_HINT =
  "Use an uploaded image, an https:// address, or a site-relative path such as /editorial/cat-neckties.webp.";

export const categoryInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the category a name")
    .max(80, "Keep the name to 80 characters or fewer"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "The slug needs at least 2 characters")
    .max(64, "Keep the slug to 64 characters or fewer")
    .regex(SLUG_RE, "Lowercase letters, numbers and single hyphens only — no spaces")
    .refine((slug) => !isReservedCollectionSlug(slug), RESERVED_SLUG_MESSAGE),
  description: z
    .string()
    .trim()
    .max(500, "Keep the description to 500 characters or fewer"),
  parentId: z.union([z.uuid("Choose a valid parent category"), z.literal("")]),
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

export type CategoryInput = z.infer<typeof categoryInputSchema>;
export type CategoryField = keyof CategoryInput;

export type CategoryFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<CategoryField, string>>;
};

export const EMPTY_FORM_STATE: CategoryFormState = { status: "idle" };

/** Result of the small imperative actions driven from row buttons. */
export type ActionResult = { ok: true } | { ok: false; message: string };
