import Image from "next/image";

const STORAGE_PUBLIC = "/storage/v1/object/public/";

/**
 * `collections.image_url` legally holds a site-relative path, an https URL or
 * a bare storage key (`cms-media/...`). next/image only understands the first
 * two, so a key is expanded to its public address.
 */
export function collectionImageSrc(url: string) {
  if (url.startsWith("https://") || url.startsWith("/")) return url;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}${STORAGE_PUBLIC}${url}`;
}

/**
 * next.config.ts only allows optimisation for our own paths and this project's
 * Supabase storage. Any other https host is still a valid address, so it is
 * served as-is instead of failing the render.
 */
function optimisable(src: string) {
  const storage = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}${STORAGE_PUBLIC}`;
  return (src.startsWith("/") && !src.startsWith("//")) || (storage.startsWith("https://") && src.startsWith(storage));
}

/** Editorial photography, filling its frame. Wrap it in a positioned box. */
export function CollectionImage({
  url,
  alt,
  sizes,
  priority = false,
  className,
}: {
  url: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const src = collectionImageSrc(url);
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      preload={priority}
      unoptimized={!optimisable(src)}
      className={className}
    />
  );
}
