/** Shared shape and URL composition for the media library. */

export type MediaAsset = {
  id: string;
  bucket: string | null;
  storage_path: string | null;
  external_url: string | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  byte_size: number | null;
  alt: string;
  is_decorative: boolean;
  title: string | null;
  folder: string;
  created_at: string;
  deleted_at: string | null;
};

export const MEDIA_COLUMNS =
  "id, bucket, storage_path, external_url, mime_type, width, height, byte_size, alt, is_decorative, title, folder, created_at, deleted_at";

export const MEDIA_FOLDERS = [
  { value: "general", label: "General" },
  { value: "banners", label: "Banners" },
  { value: "editorial", label: "Editorial" },
  { value: "products", label: "Products" },
  { value: "logos", label: "Logos" },
  { value: "og", label: "Social sharing" },
] as const;

export const MEDIA_BUCKET = "cms-media";

/** Matches the bucket allowlist in 0007_storage_buckets.sql. */
export const ACCEPTED_MIME = ["image/webp", "image/jpeg", "image/png", "image/avif"] as const;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/avif": "avif",
};

export function extensionForMime(mime: string) {
  return EXTENSION_BY_MIME[mime] ?? null;
}

/**
 * The public URL is composed here rather than stored, so the Supabase project
 * ref never gets baked into a row (see the table comment in 0004).
 */
export function mediaUrl(asset: Pick<MediaAsset, "bucket" | "storage_path" | "external_url">) {
  if (asset.external_url) return asset.external_url;
  if (!asset.bucket || !asset.storage_path) return "";
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  return `${base}/storage/v1/object/public/${asset.bucket}/${asset.storage_path}`;
}

export function folderLabel(folder: string) {
  return MEDIA_FOLDERS.find((f) => f.value === folder)?.label ?? folder;
}

export function formatBytes(bytes: number | null) {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function dimensionLabel(width: number | null, height: number | null) {
  return width && height ? `${width} × ${height}` : "—";
}

/**
 * Object keys must satisfy the storage policy regex:
 *   ^(products/<uuid>/|cms/)[0-9a-zA-Z._-]{1,120}\.(webp|jpe?g|png|avif)$
 */
export function newObjectKey(mime: string) {
  const ext = extensionForMime(mime);
  if (!ext) return null;
  return `cms/${crypto.randomUUID()}.${ext}`;
}
