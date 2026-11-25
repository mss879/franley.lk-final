"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { IMAGE_EXT_BY_TYPE, IMAGE_MAX_BYTES, PRODUCT_IMAGE_BUCKET } from "./shared";

/**
 * Photographs chosen while creating a product. The product's id is made here,
 * up front, so the files can go straight into its storage folder
 * (products/<id>/, which the bucket policy requires) before the product row
 * exists. The id and the uploaded URLs travel with the product form through
 * hidden fields; createProduct creates the product with that id and attaches
 * the photographs in the same step.
 */
export function NewProductPhotos() {
  const [productId] = useState(() => crypto.randomUUID());
  const [urls, setUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const supabase = createClient();
    const problems: string[] = [];

    for (const [index, file] of Array.from(files).entries()) {
      const ext = IMAGE_EXT_BY_TYPE[file.type];
      if (!ext) {
        problems.push(`${file.name}: only WebP, JPEG, PNG and AVIF are accepted.`);
        continue;
      }
      if (file.size > IMAGE_MAX_BYTES) {
        problems.push(`${file.name}: over the 5 MB limit.`);
        continue;
      }

      setUploading(`Uploading ${index + 1} of ${files.length}…`);
      const key = `products/${productId}/${crypto.randomUUID()}.${ext}`;
      const upload = await supabase.storage
        .from(PRODUCT_IMAGE_BUCKET)
        .upload(key, file, { contentType: file.type, upsert: false });
      if (upload.error) {
        problems.push(`${file.name}: ${upload.error.message}`);
        continue;
      }
      const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(key);
      setUrls((prev) => [...prev, data.publicUrl]);
    }

    setUploading(null);
    if (fileInput.current) fileInput.current.value = "";
    setError(problems.length ? problems.join(" ") : null);
  }

  return (
    <section className="rounded-3xl border border-cream-300 bg-white p-6 md:p-7">
      <input type="hidden" form="product-form" name="newId" value={productId} />
      <input type="hidden" form="product-form" name="pendingImages" value={JSON.stringify(urls)} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg text-ink-900">Photographs</h2>
          <p className="mt-1 max-w-md text-xs text-ink-600">
            The first is the one the product card uses. For a tie in several colours, add the photograph of
            the whole range here; each colour&apos;s own photographs are added after you create the product.
          </p>
        </div>
        <div>
          <label
            htmlFor="new-product-image-upload"
            className={cn(
              "inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-ink-900 px-6 text-sm font-medium text-cream-50",
              "transition-colors duration-300 hover:bg-wine-700",
              "focus-within:ring-2 focus-within:ring-[var(--focus-ring)] focus-within:ring-offset-2",
              uploading && "pointer-events-none opacity-60",
            )}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} aria-hidden />
            ) : (
              <ImagePlus className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            )}
            Add photographs
          </label>
          <input
            ref={fileInput}
            id="new-product-image-upload"
            type="file"
            multiple
            accept="image/webp,image/jpeg,image/png,image/avif"
            onChange={(e) => void onFiles(e.target.files)}
            className="sr-only"
          />
          <p className="mt-1.5 text-right text-[11px] text-ink-600">WebP, JPEG, PNG or AVIF · 5 MB max</p>
        </div>
      </div>

      <p aria-live="polite" className="sr-only">{uploading ?? ""}</p>

      {error && (
        <p role="alert" className="mt-4 rounded-2xl border border-wine-700/25 bg-wine-50 px-4 py-3 text-sm text-wine-700">
          {error}
        </p>
      )}

      {urls.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-cream-300 px-6 py-10 text-center text-sm text-ink-600">
          No photographs yet. They are saved with the product when you press Create.
        </p>
      ) : (
        <ul className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {urls.map((url, index) => (
            <li key={url} className="relative aspect-[4/5] overflow-hidden rounded-xl border border-cream-300 bg-white">
              <Image src={url} alt="" fill sizes="120px" className="object-contain p-1" />
              {index === 0 && (
                <span className="absolute inset-x-0 bottom-0 bg-ink-900 py-0.5 text-center text-[9px] font-medium uppercase tracking-wider text-cream-50">
                  Main
                </span>
              )}
              <button
                type="button"
                onClick={() => setUrls((prev) => prev.filter((u) => u !== url))}
                className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-ink-800 shadow-sm hover:text-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                <span className="sr-only">Remove photograph {index + 1}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
