"use client";

import { useId, useRef, useState } from "react";
import { ImageOff, Loader2, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  IMAGE_URL_HINT,
  isSafeAssetUrl,
} from "@/app/admin/(guarded)/categories/schema";

/** Mirrors the cms-media bucket's mime allowlist and 5 MB limit in 0007. */
const EXTENSION_FOR: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/avif": "avif",
};
const MAX_BYTES = 5 * 1024 * 1024;

async function measure(file: File) {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}

export function CategoryImageField({
  value,
  onChange,
  serverError,
}: {
  value: string;
  onChange: (next: string) => void;
  serverError?: string;
}) {
  const inputId = useId();
  const fileId = useId();
  const helpId = useId();
  const fileInput = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const formatError = value && !isSafeAssetUrl(value) ? IMAGE_URL_HINT : null;
  const error = uploadError ?? formatError ?? serverError ?? null;

  async function upload(file: File) {
    setNotice(null);
    setUploadError(null);

    const extension = EXTENSION_FOR[file.type];
    if (!extension) {
      setUploadError("Upload a WebP, JPEG, PNG or AVIF image — the bucket rejects anything else.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadError("That file is over the 5 MB limit. Export it smaller and try again.");
      return;
    }

    setBusy(true);
    const supabase = createClient();
    // The storage policy pins cms-media uploads to the `cms/` prefix with a
    // simple filename, so the key is generated rather than taken from the file.
    const key = `cms/${crypto.randomUUID()}.${extension}`;

    const { error: uploadFailure } = await supabase.storage
      .from("cms-media")
      .upload(key, file, { contentType: file.type, cacheControl: "31536000" });

    if (uploadFailure) {
      setUploadError(`The upload did not go through: ${uploadFailure.message}`);
      setBusy(false);
      return;
    }

    const publicUrl = supabase.storage.from("cms-media").getPublicUrl(key).data.publicUrl;
    onChange(publicUrl);

    const size = await measure(file);
    const { error: registerFailure } = await supabase.from("media_assets").insert({
      bucket: "cms-media",
      storage_path: key,
      mime_type: file.type,
      byte_size: file.size,
      width: size?.width ?? null,
      height: size?.height ?? null,
      // The storefront tile renders the name in text over the image, so the
      // picture itself is decorative and carries no alt.
      alt: "",
      is_decorative: true,
      folder: "banners",
      title: file.name.slice(0, 200),
    });

    setNotice(
      registerFailure
        ? "Uploaded and linked. It was not added to the media library, so it will not appear in the picker."
        : "Uploaded and added to the media library.",
    );
    setBusy(false);
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <div>
      <label htmlFor={inputId} className="eyebrow block text-ink-600">
        Tile image
      </label>
      <p id={helpId} className="mt-2 text-xs leading-relaxed text-ink-600">
        Shown on the homepage collection tiles. Leave it empty and the storefront falls back to the
        bundled editorial banner for this collection — a new collection has none, so its tile would
        render as a plain dark card. {IMAGE_URL_HINT}
      </p>

      <div className="mt-3 flex flex-col gap-4 rounded-2xl border border-cream-300 bg-cream-50 p-4 sm:flex-row sm:items-start">
        <div className="w-full shrink-0 overflow-hidden rounded-xl border border-cream-300 bg-cream-100 sm:w-40">
          <div className="relative aspect-[5/4]">
            {value && !formatError ? (
              // The value can be a site-relative path, a storage key or any
              // https host, which next/image's allowlist would reject.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <span className="absolute inset-0 grid place-items-center text-ink-400">
                <ImageOff className="h-5 w-5" strokeWidth={1.5} aria-hidden />
              </span>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <input
            id={inputId}
            name="imageUrl"
            type="text"
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setUploadError(null);
              setNotice(null);
            }}
            placeholder="/editorial/cat-neckties.webp"
            spellCheck={false}
            aria-describedby={helpId}
            aria-invalid={error ? true : undefined}
            className="h-11 w-full rounded-full border border-cream-300 bg-white px-5 text-sm text-ink-800 placeholder:text-ink-600 focus-visible:border-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label
              htmlFor={fileId}
              className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-ink-800/20 px-4 text-xs font-medium text-ink-800 transition-colors hover:border-wine-700 hover:text-wine-700 focus-within:ring-2 focus-within:ring-[var(--focus-ring)] focus-within:ring-offset-2"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Upload className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
              )}
              {busy ? "Uploading…" : "Upload an image"}
              <input
                id={fileId}
                ref={fileInput}
                type="file"
                accept={Object.keys(EXTENSION_FOR).join(",")}
                disabled={busy}
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(file);
                }}
              />
            </label>

            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setNotice(null);
                  setUploadError(null);
                }}
                className="inline-flex h-9 items-center gap-2 rounded-full border border-cream-300 px-4 text-xs font-medium text-ink-600 transition-colors hover:border-wine-700 hover:text-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                Clear
              </button>
            )}
          </div>

          <p aria-live="polite" className="mt-2 min-h-4 text-xs leading-relaxed">
            {error ? (
              <span className="text-wine-700">{error}</span>
            ) : notice ? (
              <span className="text-ink-600">{notice}</span>
            ) : null}
          </p>
        </div>
      </div>
    </div>
  );
}
