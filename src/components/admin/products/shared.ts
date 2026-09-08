/** Pure helpers shared by the admin product pages, the form and the actions. */

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const HEX_RE = /^#[0-9a-f]{6}$/;

export const PRODUCT_STATUSES = ["active", "draft", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const STATUS_LABEL: Record<ProductStatus, string> = {
  active: "Active",
  draft: "Draft",
  archived: "Archived",
};

export const STATUS_BADGE: Record<ProductStatus, string> = {
  active: "border-wine-700/25 bg-wine-700/8 text-wine-700",
  draft: "border-cream-300 bg-cream-100 text-ink-600",
  archived: "border-ink-400/30 bg-transparent text-ink-400",
};

/** The bucket only accepts these four types, and the key extension must match. */
export const IMAGE_EXT_BY_TYPE: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/avif": "avif",
};
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PRODUCT_IMAGE_BUCKET = "product-images";

const PUBLIC_PREFIX = "/storage/v1/object/public/";

/**
 * `product_images.url` legally holds a site-relative seed path, an https URL,
 * or a bare storage key — but next/image only understands the first two, so
 * expand keys to their public URL.
 */
export function resolveImageSrc(url: string): string {
  if (url.startsWith("https://") || url.startsWith("/")) return url;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}${PUBLIC_PREFIX}${url}`;
}

/** The object key inside `product-images`, or null for a seeded/off-bucket URL. */
export function productImageStorageKey(url: string): string | null {
  const marker = `${PUBLIC_PREFIX}${PRODUCT_IMAGE_BUCKET}/`;
  const at = url.indexOf(marker);
  if (at !== -1) return decodeURIComponent(url.slice(at + marker.length));
  if (url.startsWith(`${PRODUCT_IMAGE_BUCKET}/`)) return url.slice(PRODUCT_IMAGE_BUCKET.length + 1);
  return null;
}

export type StockState = "out" | "low" | "ok";

export function stockState(stock: number, threshold: number): StockState {
  if (stock <= 0) return "out";
  return stock <= threshold ? "low" : "ok";
}

export type CategoryOption = {
  id: string;
  name: string;
  parentName: string | null;
};

/** Shape returned by every product form action to `useActionState`. */
export type ProductFormState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
} | null;

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; message: string };
