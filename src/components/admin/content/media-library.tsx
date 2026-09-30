"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Loader2,
  Pencil,
  Replace as ReplaceIcon,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  MEDIA_BUCKET,
  MEDIA_FOLDERS,
  dimensionLabel,
  folderLabel,
  formatBytes,
  mediaUrl,
  type MediaAsset,
} from "./media";
import { appendUploaded, checkFile, uploadToBucket } from "./upload";
import type { ActionState } from "./types";
import {
  EmptyState,
  Pill,
  StatusMessage,
  focusRing,
  inputArea,
  inputPill,
  selectPill,
} from "./ui";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

export type MediaActions = {
  create: Action;
  update: Action;
  replace: Action;
  setDeleted: Action;
};

export function MediaLibrary({
  assets,
  folder,
  showRemoved,
  createAction,
  updateAction,
  replaceAction,
  deleteAction,
}: {
  assets: MediaAsset[];
  folder: string;
  showRemoved: boolean;
  // Passed one by one rather than in an object: server actions cross the
  // client boundary as individual references.
  createAction: Action;
  updateAction: Action;
  replaceAction: Action;
  deleteAction: Action;
}) {
  const actions: MediaActions = {
    create: createAction,
    update: updateAction,
    replace: replaceAction,
    setDeleted: deleteAction,
  };

  const filterHref = (nextFolder: string, nextRemoved = showRemoved) => {
    const params = new URLSearchParams();
    if (nextFolder) params.set("folder", nextFolder);
    if (nextRemoved) params.set("removed", "1");
    const q = params.toString();
    return `/admin/content/media${q ? `?${q}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-10">
      <UploadPanel action={actions.create} defaultFolder={folder || "general"} />

      <section aria-labelledby="library-heading" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-cream-300 pb-4">
          <h2 id="library-heading" className="font-display text-xl text-ink-900">
            {showRemoved ? "Removed images" : "Your images"}
          </h2>
          <Link
            href={filterHref(folder, !showRemoved)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs text-ink-600 underline-offset-4 transition-colors hover:text-wine-700 hover:underline",
              focusRing,
            )}
          >
            {showRemoved ? "Back to the library" : "Show removed images"}
          </Link>
        </div>

        <nav aria-label="Filter by folder" className="flex flex-wrap gap-2">
          {[{ value: "", label: "All" }, ...MEDIA_FOLDERS].map((f) => (
            <Link
              key={f.value || "all"}
              href={filterHref(f.value)}
              aria-current={folder === f.value ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center rounded-full border px-4 text-xs font-medium transition-colors",
                folder === f.value
                  ? "border-ink-900 bg-ink-900 text-cream-50"
                  : "border-cream-300 text-ink-600 hover:border-wine-700 hover:text-wine-700",
                focusRing,
              )}
            >
              {f.label}
            </Link>
          ))}
        </nav>

        {assets.length === 0 ? (
          <EmptyState
            title={showRemoved ? "Nothing has been removed" : "No images here yet"}
            body={
              showRemoved
                ? "Images you remove from the library end up here, and can be put back."
                : "Upload a banner, a hero photograph or an editorial shot above, and it becomes available to every image field in the content editor."
            }
          />
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {assets.map((asset) => (
              <MediaCard key={asset.id} asset={asset} actions={actions} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ upload */

function UploadPanel({ action, defaultFolder }: { action: Action; defaultFolder: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [dims, setDims] = useState<{ width: number; height: number } | null>(null);
  const [decorative, setDecorative] = useState(false);
  const [alt, setAlt] = useState("");
  const [status, setStatus] = useState<ActionState>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    formRef.current?.reset();
    setFile(null);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return "";
    });
    setDims(null);
    setDecorative(false);
    setAlt("");
  };

  const onFile = (next: File | null) => {
    setStatus(null);
    setDims(null);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return "";
    });
    if (!next) {
      setFile(null);
      return;
    }
    const problem = checkFile(next);
    if (problem) {
      setFile(null);
      setStatus({ ok: false, message: problem });
      return;
    }
    setFile(next);
    const url = URL.createObjectURL(next);
    setPreview(url);
    const img = document.createElement("img");
    img.onload = () => setDims({ width: img.naturalWidth, height: img.naturalHeight });
    img.src = url;
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || busy) return;

    // Mirrors the media_assets_alt_required constraint, so a failed insert
    // never leaves an orphaned object in the bucket.
    if (!decorative && alt.trim() === "") {
      setStatus({ ok: false, message: "Describe the image, or tick “decorative”." });
      return;
    }

    setBusy(true);
    setStatus(null);
    const formData = new FormData(event.currentTarget);

    const uploaded = await uploadToBucket(file);
    if (!uploaded.ok) {
      setStatus({ ok: false, message: uploaded.message });
      setBusy(false);
      return;
    }

    appendUploaded(formData, uploaded.file);
    const result = await action(null, formData);
    setStatus(result);
    setBusy(false);
    if (result?.ok) {
      reset();
      router.refresh();
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="rounded-[--radius-card] border border-cream-300 bg-white p-6"
    >
      <h2 className="eyebrow text-champagne-700">Add an image</h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-600">
        JPG, PNG, WebP or AVIF, up to 5 MB. The size is read from the file so pages never jump
        while the image loads.
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-[10rem_1fr]">
        <div className="flex flex-col gap-3">
          <div className="relative aspect-square w-40 overflow-hidden rounded-2xl border border-cream-300 bg-cream-100">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- a blob: preview of a file that is not uploaded yet
              <img src={preview} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="grid h-full w-full place-items-center text-ink-400">
                <Upload className="h-6 w-6" strokeWidth={1.5} aria-hidden />
              </span>
            )}
          </div>
          {dims && (
            <p className="text-xs text-ink-600">
              {dims.width} × {dims.height} · {file ? formatBytes(file.size) : ""}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="upload-file" className="text-sm font-medium text-ink-800">
              Image file <span className="text-wine-700" aria-hidden>*</span>
            </label>
            <input
              id="upload-file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              className={cn(
                "w-full rounded-full border border-cream-300 bg-white text-sm text-ink-800",
                "file:mr-4 file:h-11 file:rounded-full file:border-0 file:bg-cream-100 file:px-5 file:text-sm file:font-medium file:text-wine-700",
                "hover:file:bg-cream-200",
                focusRing,
              )}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="upload-alt" className="text-sm font-medium text-ink-800">
              Describe the image
              {!decorative && (
                <span className="text-wine-700" aria-hidden>
                  {" "}*
                </span>
              )}
            </label>
            <p className="text-xs leading-relaxed text-ink-600">
              What someone would see if they could not see the picture, e.g. “Groom in a grey
              three-piece suit wearing a burgundy striped tie”.
            </p>
            <textarea
              id="upload-alt"
              name="alt"
              rows={2}
              maxLength={400}
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              className={inputArea}
            />
            <div className="flex items-start gap-3 pt-1">
              <input
                id="upload-decorative"
                name="is_decorative"
                type="checkbox"
                checked={decorative}
                onChange={(e) => setDecorative(e.target.checked)}
                className={cn("mt-0.5 h-4 w-4 accent-ink-900", focusRing)}
              />
              <label htmlFor="upload-decorative" className="text-xs leading-relaxed text-ink-600">
                This image is decorative — it carries no information of its own, so screen readers
                should skip it.
              </label>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="upload-title" className="text-sm font-medium text-ink-800">
                Name (optional)
              </label>
              <input
                id="upload-title"
                name="title"
                type="text"
                maxLength={200}
                placeholder="Autumn banner"
                className={inputPill}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="upload-folder" className="text-sm font-medium text-ink-800">
                Folder
              </label>
              <select
                id="upload-folder"
                name="folder"
                defaultValue={defaultFolder}
                className={selectPill}
              >
                {MEDIA_FOLDERS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={!file || busy}
              className={cn(
                "inline-flex h-11 items-center gap-2 rounded-full bg-ink-900 px-6 text-sm font-medium text-cream-50 transition-colors hover:bg-wine-700 disabled:pointer-events-none disabled:opacity-50",
                focusRing,
              )}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
              {busy ? "Uploading…" : "Upload image"}
            </button>
            <StatusMessage state={status} />
          </div>
        </div>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------- card */

function MediaCard({ asset, actions }: { asset: MediaAsset; actions: MediaActions }) {
  const router = useRouter();
  const url = mediaUrl(asset);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<ActionState>(null);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const replaceRef = useRef<HTMLInputElement>(null);
  const removed = asset.deleted_at !== null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setStatus({ ok: false, message: "Could not copy. Select the address and copy it manually." });
    }
  };

  const run = (formData: FormData, action: Action) =>
    startTransition(async () => {
      const result = await action(null, formData);
      setStatus(result);
      if (result?.ok) {
        setEditing(false);
        router.refresh();
      }
    });

  const onReplace = async (file: File | null) => {
    if (!file || busy) return;
    setBusy(true);
    setStatus(null);
    const uploaded = await uploadToBucket(file);
    if (!uploaded.ok) {
      setStatus({ ok: false, message: uploaded.message });
      setBusy(false);
      return;
    }
    const formData = new FormData();
    formData.set("id", asset.id);
    appendUploaded(formData, uploaded.file);
    const result = await actions.replace(null, formData);
    setStatus(result);
    setBusy(false);
    if (replaceRef.current) replaceRef.current.value = "";

    if (result?.ok) {
      // Best effort: drop the object the row no longer points at.
      if (asset.bucket === MEDIA_BUCKET && asset.storage_path) {
        await createClient().storage.from(MEDIA_BUCKET).remove([asset.storage_path]);
      }
      router.refresh();
    }
  };

  const toggleDeleted = () => {
    const formData = new FormData();
    formData.set("id", asset.id);
    formData.set("deleted", removed ? "false" : "true");
    run(formData, actions.setDeleted);
  };

  return (
    <li className="flex flex-col overflow-hidden rounded-[--radius-card] border border-cream-300 bg-white">
      <div className="relative aspect-[4/3] shrink-0 overflow-hidden bg-cream-100">
        {url && (
          <Image
            src={url}
            alt={asset.alt || ""}
            fill
            sizes="(max-width: 640px) 100vw, 360px"
            unoptimized
            className={cn("object-cover", removed && "opacity-40 grayscale")}
          />
        )}
        {removed && (
          <span className="absolute left-3 top-3">
            <Pill tone="off">Removed</Pill>
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="truncate text-sm font-medium text-ink-800">
            {asset.title || asset.alt || "Untitled image"}
          </h3>
          <p className="mt-1 text-xs text-ink-600">
            {folderLabel(asset.folder)} · {dimensionLabel(asset.width, asset.height)} ·{" "}
            {formatBytes(asset.byte_size)}
          </p>
          {asset.is_decorative && <p className="mt-1 text-xs text-ink-600">Marked decorative</p>}
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-1.5">
          <IconAction onClick={copy} label={copied ? "Copied" : "Copy address"}>
            {copied ? (
              <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            ) : (
              <Copy className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
            )}
            {copied ? "Copied" : "Copy URL"}
          </IconAction>

          {!removed && (
            <>
              <IconAction onClick={() => setEditing((v) => !v)} label={`Edit ${asset.title || "image"}`} pressed={editing}>
                <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                Details
              </IconAction>

              <IconAction
                onClick={() => replaceRef.current?.click()}
                label={`Replace the file behind ${asset.title || "this image"}`}
                disabled={busy}
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <ReplaceIcon className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                )}
                Replace
              </IconAction>
            </>
          )}

          <IconAction onClick={toggleDeleted} label={removed ? "Restore" : "Remove"} disabled={pending}>
            {removed ? (
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
            ) : (
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
            )}
            {removed ? "Restore" : "Remove"}
          </IconAction>
        </div>

        <input
          ref={replaceRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => void onReplace(e.target.files?.[0] ?? null)}
        />

        {status && (
          <p aria-live="polite" className="text-xs text-wine-700">
            {status.message}
          </p>
        )}

        {editing && !removed && (
          <MediaDetailsForm
            asset={asset}
            pending={pending}
            onSubmit={(formData) => run(formData, actions.update)}
            onCancel={() => setEditing(false)}
          />
        )}
      </div>
    </li>
  );
}

function IconAction({
  onClick,
  label,
  disabled,
  pressed,
  children,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border border-cream-300 px-3 text-xs text-ink-600 transition-colors hover:border-wine-700 hover:text-wine-700 disabled:opacity-50",
        pressed && "border-wine-700 text-wine-700",
        focusRing,
      )}
    >
      {children}
    </button>
  );
}

function MediaDetailsForm({
  asset,
  pending,
  onSubmit,
  onCancel,
}: {
  asset: MediaAsset;
  pending: boolean;
  onSubmit: (formData: FormData) => void;
  onCancel: () => void;
}) {
  const [decorative, setDecorative] = useState(asset.is_decorative);
  const ids = {
    alt: `alt-${asset.id}`,
    title: `title-${asset.id}`,
    folder: `folder-${asset.id}`,
    decorative: `dec-${asset.id}`,
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
      className="flex flex-col gap-4 border-t border-cream-300 pt-4"
    >
      <input type="hidden" name="id" value={asset.id} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.alt} className="text-xs font-medium text-ink-800">
          Description
        </label>
        <textarea
          id={ids.alt}
          name="alt"
          rows={2}
          maxLength={400}
          defaultValue={asset.alt}
          className={cn(inputArea, "text-xs")}
        />
      </div>

      <div className="flex items-start gap-2.5">
        <input
          id={ids.decorative}
          name="is_decorative"
          type="checkbox"
          checked={decorative}
          onChange={(e) => setDecorative(e.target.checked)}
          className={cn("mt-0.5 h-4 w-4 accent-ink-900", focusRing)}
        />
        <label htmlFor={ids.decorative} className="text-xs leading-relaxed text-ink-600">
          Decorative — no description needed
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.title} className="text-xs font-medium text-ink-800">
          Name
        </label>
        <input
          id={ids.title}
          name="title"
          type="text"
          maxLength={200}
          defaultValue={asset.title ?? ""}
          className={cn(inputPill, "h-9 text-xs")}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.folder} className="text-xs font-medium text-ink-800">
          Folder
        </label>
        <select
          id={ids.folder}
          name="folder"
          defaultValue={asset.folder}
          className={cn(selectPill, "h-9 text-xs")}
        >
          {MEDIA_FOLDERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-full bg-ink-900 px-4 text-xs font-medium text-cream-50 transition-colors hover:bg-wine-700 disabled:opacity-50",
            focusRing,
          )}
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs text-ink-600 transition-colors hover:text-wine-700",
            focusRing,
          )}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
