"use client";

import { useId, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ImagePlus, Loader2, Plus, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createMediaAsset } from "@/app/admin/(guarded)/content/actions";
import {
  isImageField,
  isLinkField,
  type CollectionOption,
  type FieldDescriptor,
} from "./types";
import { ACCEPTED_MIME, MEDIA_BUCKET, mediaUrl, type MediaAsset } from "./media";
import { MediaPickerDialog } from "./media-picker";
import { appendUploaded, uploadToBucket } from "./upload";
import { FieldShell, focusRing, inputArea, inputPill, selectPill } from "./ui";

export const FIELD_INPUT_PREFIX = "f:";

const LINK_HELP = "Start with / for a page on this site, or https:// for somewhere else.";

export function BlockFieldControl({
  field,
  value,
  onChange,
  error,
  collections = [],
  uploadFolder = "general",
}: {
  field: FieldDescriptor;
  value: string | boolean;
  onChange: (next: string | boolean) => void;
  error?: string | null;
  /** The shop's collections, for a "collection" field. */
  collections?: CollectionOption[];
  /** Media library folder that an image uploaded from this form is filed under. */
  uploadFolder?: string;
}) {
  const reactId = useId();
  const id = `${reactId}-${field.name.replace(/[^a-zA-Z0-9]/g, "-")}`;
  const name = `${FIELD_INPUT_PREFIX}${field.name}`;
  const described = error ? `${id}-error` : undefined;
  const text = typeof value === "string" ? value : "";

  if (field.type === "boolean") {
    const on = value === true;
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-3">
          <input
            id={id}
            name={name}
            type="checkbox"
            checked={on}
            onChange={(e) => onChange(e.target.checked)}
            className={cn("mt-0.5 h-4 w-4 shrink-0 accent-ink-900", focusRing)}
          />
          <label htmlFor={id} className="text-sm font-medium text-ink-800">
            {field.label}
          </label>
        </div>
        {field.help && <p className="pl-7 text-xs leading-relaxed text-ink-600">{field.help}</p>}
        {error && (
          <p id={`${id}-error`} className="pl-7 text-xs text-wine-700">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (isImageField(field.type)) {
    return (
      <ImageField
        id={id}
        name={name}
        field={field}
        value={text}
        onChange={onChange}
        error={error}
        uploadFolder={uploadFolder}
      />
    );
  }

  if (field.type === "collection") {
    return (
      <CollectionField
        id={id}
        name={name}
        field={field}
        value={text}
        onChange={onChange}
        error={error}
        collections={collections}
      />
    );
  }

  if (field.type === "string_list") {
    const lines = text.split("\n").filter((l) => l.trim()).length;
    const over = field.maxItems ? lines > field.maxItems : false;
    return (
      <FieldShell
        htmlFor={id}
        label={field.label}
        help={field.help ?? "One per line."}
        required={field.required}
        error={error}
        hint={
          <span className={cn("text-xs", over ? "text-wine-700" : "text-ink-600")}>
            {lines}
            {field.maxItems ? ` / ${field.maxItems}` : ""} lines
          </span>
        }
      >
        <textarea
          id={id}
          name={name}
          rows={field.rows ?? Math.max(4, Math.min(lines + 1, 10))}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={described}
          className={inputArea}
        />
      </FieldShell>
    );
  }

  if (field.type === "textarea") {
    return (
      <FieldShell
        htmlFor={id}
        label={field.label}
        help={field.help}
        required={field.required}
        error={error}
        hint={<CharCount value={text} max={field.maxLength} />}
      >
        <textarea
          id={id}
          name={name}
          rows={field.rows ?? 4}
          maxLength={field.maxLength ?? undefined}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={described}
          className={inputArea}
        />
      </FieldShell>
    );
  }

  if (field.type === "select") {
    return (
      <FieldShell htmlFor={id} label={field.label} help={field.help} required={field.required} error={error}>
        <select
          id={id}
          name={name}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={described}
          className={selectPill}
        >
          {!field.required && <option value="">Not set</option>}
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </FieldShell>
    );
  }

  if (field.type === "number") {
    return (
      <FieldShell htmlFor={id} label={field.label} help={field.help} required={field.required} error={error}>
        <input
          id={id}
          name={name}
          type="number"
          inputMode="decimal"
          value={text}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={described}
          className={cn(inputPill, "max-w-[14rem]")}
        />
      </FieldShell>
    );
  }

  // text | url | link
  return (
    <FieldShell
      htmlFor={id}
      label={field.label}
      help={field.help ?? (isLinkField(field.type) ? LINK_HELP : null)}
      required={field.required}
      error={error}
      hint={<CharCount value={text} max={field.maxLength} />}
    >
      <input
        id={id}
        name={name}
        type="text"
        inputMode={isLinkField(field.type) ? "url" : "text"}
        maxLength={field.maxLength ?? undefined}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={described}
        className={inputPill}
      />
    </FieldShell>
  );
}

function CharCount({ value, max }: { value: string; max: number | null }) {
  if (!max) return null;
  const near = value.length > max * 0.85;
  return (
    <span className={cn("text-xs tabular-nums", near ? "text-champagne-600" : "text-ink-600")}>
      {value.length} / {max}
    </span>
  );
}

function ImageField({
  id,
  name,
  field,
  value,
  onChange,
  error,
  uploadFolder,
}: {
  id: string;
  name: string;
  field: FieldDescriptor;
  value: string;
  onChange: (next: string) => void;
  error?: string | null;
  uploadFolder: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadNote, setUploadNote] = useState<{ ok: boolean; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const fileId = `${id}-file`;

  const pick = (asset: MediaAsset) => {
    onChange(mediaUrl(asset));
    setUploadNote(null);
    setPickerOpen(false);
  };

  /**
   * Straight from this form: the file goes into the cms-media bucket from the
   * browser (as the media library does), is recorded in the library so it
   * can be picked again later, and fills this field. The block's own
   * "description" field carries the alt text, so the library copy is filed
   * as decorative.
   */
  async function upload(file: File) {
    setUploadNote(null);
    setUploading(true);
    const result = await uploadToBucket(file);
    if (!result.ok) {
      setUploadNote({ ok: false, text: result.message });
      setUploading(false);
      return;
    }

    onChange(mediaUrl({ bucket: MEDIA_BUCKET, storage_path: result.file.storage_path, external_url: null }));

    const formData = new FormData();
    appendUploaded(formData, result.file);
    formData.set("alt", "");
    formData.set("is_decorative", "on");
    formData.set("title", file.name.slice(0, 200));
    formData.set("folder", uploadFolder);
    const registered = await createMediaAsset(null, formData).catch(() => null);

    setUploadNote({
      ok: true,
      text: registered?.ok
        ? "Uploaded. Press “Save changes” to put it on the site."
        : "Uploaded. Press “Save changes” to put it on the site. (It was not added to the media library.)",
    });
    setUploading(false);
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <FieldShell
      htmlFor={id}
      label={field.label}
      help={field.help ?? "Pick from the media library, or paste an image address."}
      required={field.required}
      error={error}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-cream-300 bg-cream-100">
          {value ? (
            // Unoptimised: an admin-pasted address may sit outside the
            // next/image remotePatterns allowlist, and a thumbnail is not
            // worth a render-time throw.
            <Image src={value} alt="" fill sizes="96px" unoptimized className="object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center text-ink-400">
              <ImagePlus className="h-5 w-5" strokeWidth={1.5} aria-hidden />
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <input
            id={id}
            name={name}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="/editorial/hero-gentleman.webp"
            aria-describedby={error ? `${id}-error` : undefined}
            className={inputPill}
          />
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor={fileId}
              className={cn(
                "inline-flex h-9 cursor-pointer items-center gap-2 rounded-full bg-ink-900 px-4 text-xs font-medium text-cream-50 transition-colors hover:bg-wine-700",
                "focus-within:ring-2 focus-within:ring-[var(--focus-ring)] focus-within:ring-offset-2",
                uploading && "cursor-wait opacity-80",
              )}
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Upload className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
              )}
              {uploading ? "Uploading…" : "Upload new image"}
              <input
                id={fileId}
                ref={fileInput}
                type="file"
                accept={ACCEPTED_MIME.join(",")}
                disabled={uploading}
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(file);
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-full border border-cream-300 px-4 text-xs font-medium text-ink-800 transition-colors hover:border-wine-700 hover:text-wine-700",
                focusRing,
              )}
            >
              <ImagePlus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
              Choose from library
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-full px-4 text-xs text-ink-600 transition-colors hover:text-wine-700",
                  focusRing,
                )}
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                Clear
              </button>
            )}
          </div>
          <p aria-live="polite" className="min-h-4 text-xs leading-relaxed">
            {uploadNote && (
              <span className={uploadNote.ok ? "text-ink-600" : "text-wine-700"}>{uploadNote.text}</span>
            )}
          </p>
        </div>
      </div>

      <MediaPickerDialog open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={pick} />
    </FieldShell>
  );
}

/**
 * Which collection fills a home-page product section. A select over the shop's
 * collections, plus the way through to choosing that collection's products —
 * which is the part the owner actually came for.
 */
function CollectionField({
  id,
  name,
  field,
  value,
  onChange,
  error,
  collections,
}: {
  id: string;
  name: string;
  field: FieldDescriptor;
  value: string;
  onChange: (next: string) => void;
  error?: string | null;
  collections: CollectionOption[];
}) {
  const selected = collections.find((c) => c.slug === value) ?? null;
  // A slug saved before its collection was renamed or deleted still shows,
  // so the admin can see what is wrong instead of a silently-changed select.
  const missing = value !== "" && !selected;
  const notLive = selected && (!selected.isActive || selected.liveCount === 0);

  return (
    <FieldShell
      htmlFor={id}
      label={field.label}
      help={field.help}
      required={field.required}
      error={error}
    >
      <select
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={selectPill}
      >
        {value === "" && (
          <option value="" disabled>
            Choose a collection
          </option>
        )}
        {missing && <option value={value}>{value} (no longer exists)</option>}
        {collections.map((c) => (
          <option key={c.id} value={c.slug}>
            {c.name}
            {c.isActive ? ` · ${c.liveCount} live` : " · hidden"}
          </option>
        ))}
      </select>

      <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-cream-300 bg-cream-50 px-4 py-3">
        {selected ? (
          <>
            <p className="text-sm text-ink-800">
              Showing the products in <span className="font-medium">“{selected.name}”</span>, in that
              collection’s order — the first eight appear here.
            </p>
            {notLive && (
              <p className="text-xs leading-relaxed text-wine-700">
                {selected.isActive
                  ? "This collection has no active products yet, "
                  : "This collection is hidden, "}
                so the section shows its automatic list instead until it does.
              </p>
            )}
            <Link
              href={`/admin/collections/${selected.id}/edit`}
              className={cn(
                "inline-flex w-fit items-center gap-1.5 rounded-full text-sm font-medium text-wine-700 underline-offset-4 hover:underline",
                focusRing,
              )}
            >
              Choose the products in “{selected.name}”
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            </Link>
            <p className="text-xs text-ink-600">Save any changes on this page first.</p>
          </>
        ) : (
          <p className="text-xs leading-relaxed text-ink-600">
            {missing
              ? "That collection no longer exists, so the section shows its automatic list. Pick another one."
              : "Pick the collection whose products this section shows."}
          </p>
        )}
        <Link
          href="/admin/collections/new"
          className={cn(
            "inline-flex w-fit items-center gap-1.5 rounded-full text-xs text-ink-600 transition-colors hover:text-wine-700",
            focusRing,
          )}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
          Make a new collection for this section
        </Link>
      </div>
    </FieldShell>
  );
}
