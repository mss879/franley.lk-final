"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { MEDIA_COLUMNS, MEDIA_FOLDERS, mediaUrl, type MediaAsset } from "./media";
import { focusRing, selectPill } from "./ui";

/**
 * Picks an existing image out of media_assets. Reads through the browser
 * client — media rows are publicly readable, so no server round-trip is needed
 * just to draw a grid.
 */
export function MediaPickerDialog({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (asset: MediaAsset) => void;
}) {
  // Mounted only while open, so each opening starts from a clean fetch.
  if (!open) return null;
  return <PickerBody onClose={onClose} onPick={onPick} />;
}

type Loaded = { folder: string; assets: MediaAsset[]; error: string | null };

function PickerBody({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (asset: MediaAsset) => void;
}) {
  const [folder, setFolder] = useState("");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Derived, not stored: a stale result for a different folder still reads as
  // "loading" without a synchronous state write.
  const loading = loaded === null || loaded.folder !== folder;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      let query = supabase
        .from("media_assets")
        .select(MEDIA_COLUMNS)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(90);
      if (folder) query = query.eq("folder", folder);

      const { data, error } = await query;
      if (cancelled) return;
      setLoaded({
        folder,
        assets: (data ?? []) as unknown as MediaAsset[],
        error: error ? "Could not load the media library." : null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [folder]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const assets = loading ? [] : loaded.assets;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose an image"
        className="flex max-h-[88dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[--radius-card] border border-cream-300 bg-cream-50 sm:rounded-[--radius-card]"
      >
        <div className="flex items-center justify-between gap-4 border-b border-cream-300 px-6 py-5">
          <div>
            <h2 className="font-display text-xl text-ink-900">Choose an image</h2>
            <p className="mt-1 text-xs text-ink-600">From your media library.</p>
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="picker-folder" className="sr-only">
              Filter by folder
            </label>
            <select
              id="picker-folder"
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              className={cn(selectPill, "h-10 w-40 text-xs")}
            >
              <option value="">All folders</option>
              {MEDIA_FOLDERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close"
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-full border border-cream-300 text-ink-600 transition-colors hover:border-wine-700 hover:text-wine-700",
                focusRing,
              )}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6" aria-live="polite">
          {loading && (
            <p className="flex items-center gap-2 text-sm text-ink-600">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading images…
            </p>
          )}
          {!loading && loaded.error && <p className="text-sm text-wine-700">{loaded.error}</p>}
          {!loading && !loaded.error && assets.length === 0 && (
            <p className="text-sm text-ink-600">
              No images here yet. Upload some from Content &amp; Banners → Media library.
            </p>
          )}
          {assets.length > 0 && (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {assets.map((asset) => {
                const url = mediaUrl(asset);
                return (
                  <li key={asset.id}>
                    <button
                      type="button"
                      onClick={() => onPick(asset)}
                      className={cn(
                        "group block w-full overflow-hidden rounded-2xl border border-cream-300 bg-white text-left transition-colors hover:border-wine-700",
                        focusRing,
                      )}
                    >
                      <span className="relative block aspect-square overflow-hidden bg-cream-100">
                        {url && (
                          <Image
                            src={url}
                            alt={asset.alt || ""}
                            fill
                            sizes="220px"
                            unoptimized
                            className="object-cover transition-transform duration-500 ease-[--ease-lux] group-hover:scale-[1.03]"
                          />
                        )}
                      </span>
                      <span className="block px-3 py-2.5">
                        <span className="block truncate text-xs font-medium text-ink-800">
                          {asset.title || asset.alt || "Untitled image"}
                        </span>
                        <span className="mt-0.5 block text-[0.6875rem] text-ink-600">
                          {asset.width && asset.height
                            ? `${asset.width} × ${asset.height}`
                            : "Size unknown"}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
