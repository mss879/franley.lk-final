"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Trash2, TriangleAlert } from "lucide-react";
import {
  addProductImage,
  deleteProductImage,
  moveProductImage,
  updateProductImageAlt,
} from "@/app/admin/(guarded)/products/actions";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { inputClass } from "./fields";
import {
  IMAGE_EXT_BY_TYPE,
  IMAGE_MAX_BYTES,
  PRODUCT_IMAGE_BUCKET,
  resolveImageSrc,
} from "./shared";

export type ProductImageRow = {
  id: string;
  url: string;
  alt: string | null;
  position: number;
};

const iconButton =
  "inline-flex h-9 w-9 items-center justify-center rounded-full border border-cream-300 text-ink-600 " +
  "transition-colors duration-200 hover:border-wine-700 hover:text-wine-700 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 " +
  "disabled:pointer-events-none disabled:opacity-40";

export function ProductImages({
  productId,
  productTitle,
  images,
}: {
  productId: string;
  productTitle: string;
  images: ProductImageRow[];
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);

    const supabase = createClient();
    const problems: string[] = [];
    let added = 0;

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

      // The bucket policy pins keys to products/<product uuid>/<name>.<ext>.
      const key = `products/${productId}/${crypto.randomUUID()}.${ext}`;
      const upload = await supabase.storage
        .from(PRODUCT_IMAGE_BUCKET)
        .upload(key, file, { contentType: file.type, upsert: false });

      if (upload.error) {
        problems.push(`${file.name}: ${upload.error.message}`);
        continue;
      }

      const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(key);
      const result = await addProductImage({
        productId,
        url: data.publicUrl,
        alt: productTitle || file.name.replace(/\.[a-z0-9]+$/i, ""),
      });

      if (!result.ok) {
        // Never leave an object in the bucket with no row pointing at it.
        await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([key]);
        problems.push(`${file.name}: ${result.message}`);
        continue;
      }
      added += 1;
    }

    setUploading(null);
    if (fileInput.current) fileInput.current.value = "";
    setError(problems.length ? problems.join(" ") : null);
    if (added) router.refresh();
  }

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.message ?? "Something went wrong.");
      else router.refresh();
    });
  };

  const missingAlt = images.filter((img) => !img.alt?.trim()).length;

  return (
    <section className="rounded-3xl border border-cream-300 bg-white p-6 md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg text-ink-900">Photographs</h2>
          <p className="mt-1 text-xs text-ink-600">
            Shot on white. The first image is the one the product card uses.
          </p>
        </div>

        <div>
          <label
            htmlFor="product-image-upload"
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
            id="product-image-upload"
            type="file"
            multiple
            accept="image/webp,image/jpeg,image/png,image/avif"
            onChange={(e) => void onFiles(e.target.files)}
            className="sr-only"
          />
          <p className="mt-1.5 text-right text-[11px] text-ink-600">WebP, JPEG, PNG or AVIF · 5 MB max</p>
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {uploading ?? (pending ? "Updating the gallery" : "")}
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-2xl border border-wine-700/25 bg-wine-50 px-4 py-3 text-sm text-wine-700">
          {error}
        </p>
      )}

      {missingAlt > 0 && (
        <p className="mt-4 flex items-start gap-2 rounded-2xl border border-champagne-400 bg-champagne-100 px-4 py-3 text-sm text-ink-800">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
          {missingAlt === 1
            ? "One image has no alt text. Screen readers will announce nothing for it."
            : `${missingAlt} images have no alt text. Screen readers will announce nothing for them.`}
        </p>
      )}

      {images.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-cream-300 px-6 py-14 text-center">
          <p className="font-display text-xl text-ink-900">No photographs yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-600">
            Add at least one. Without it the product card falls back to an empty frame on the
            storefront.
          </p>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {images.map((image, index) => (
            <li
              key={image.id}
              className="flex flex-col gap-4 rounded-2xl border border-cream-300 p-3 sm:flex-row sm:items-center"
            >
              <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl border border-cream-300 bg-white">
                <Image
                  src={resolveImageSrc(image.url)}
                  alt=""
                  fill
                  sizes="80px"
                  className="object-contain p-1"
                />
                {index === 0 && (
                  <span className="absolute inset-x-0 bottom-0 bg-ink-900 py-0.5 text-center text-[9px] font-medium uppercase tracking-wider text-cream-50">
                    Main
                  </span>
                )}
              </div>

              <AltEditor
                imageId={image.id}
                initialAlt={image.alt ?? ""}
                onError={setError}
                onSaved={() => router.refresh()}
              />

              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  className={iconButton}
                  disabled={pending || index === 0}
                  title="Move earlier"
                  onClick={() => run(() => moveProductImage(image.id, "up"))}
                >
                  <ArrowUp className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                  <span className="sr-only">Move image {index + 1} earlier</span>
                </button>
                <button
                  type="button"
                  className={iconButton}
                  disabled={pending || index === images.length - 1}
                  title="Move later"
                  onClick={() => run(() => moveProductImage(image.id, "down"))}
                >
                  <ArrowDown className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                  <span className="sr-only">Move image {index + 1} later</span>
                </button>
                <DeleteImageButton
                  disabled={pending}
                  position={index + 1}
                  onDelete={() => run(() => deleteProductImage(image.id))}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AltEditor({
  imageId,
  initialAlt,
  onError,
  onSaved,
}: {
  imageId: string;
  initialAlt: string;
  onError: (message: string | null) => void;
  onSaved: () => void;
}) {
  const [alt, setAlt] = useState(initialAlt);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const id = `alt-${imageId}`;

  async function save() {
    const next = alt.trim();
    if (next === initialAlt.trim()) return;
    if (!next) {
      onError("Alt text is required — describe the photograph in a few words.");
      return;
    }
    setSaving(true);
    const result = await updateProductImageAlt(imageId, next);
    setSaving(false);
    if (!result.ok) {
      onError(result.message);
      return;
    }
    onError(null);
    setSaved(true);
    onSaved();
  }

  return (
    <div className="min-w-0 flex-1 space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium text-ink-600">
        Alt text
      </label>
      <input
        id={id}
        value={alt}
        maxLength={300}
        required
        aria-invalid={alt.trim() ? undefined : true}
        aria-describedby={`${id}-status`}
        onChange={(e) => {
          setAlt(e.target.value);
          setSaved(false);
        }}
        onBlur={() => void save()}
        placeholder="Navy fine-twill necktie, folded"
        className={cn(inputClass, !alt.trim() && "border-wine-600")}
      />
      <p id={`${id}-status`} aria-live="polite" className="text-xs text-ink-600">
        {saving ? "Saving…" : saved ? "Saved." : "Saved when you move away from the field."}
      </p>
    </div>
  );
}

function DeleteImageButton({
  disabled,
  position,
  onDelete,
}: {
  disabled: boolean;
  position: number;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        disabled={disabled}
        title="Delete image"
        onClick={() => setConfirming(true)}
        className={cn(iconButton, "hover:border-wine-700 hover:text-wine-700")}
      >
        <Trash2 className="h-4 w-4" strokeWidth={1.5} aria-hidden />
        <span className="sr-only">Delete image {position}</span>
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={disabled}
        onClick={onDelete}
        className="inline-flex h-9 items-center rounded-full bg-ink-900 px-4 text-xs font-medium text-cream-50 transition-colors hover:bg-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 disabled:opacity-50"
      >
        Delete image {position}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-xs text-ink-600 underline underline-offset-4 hover:text-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
      >
        Cancel
      </button>
    </span>
  );
}
