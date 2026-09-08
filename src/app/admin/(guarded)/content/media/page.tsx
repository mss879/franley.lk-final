import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { AdminPageShell } from "@/components/admin/page-shell";
import { requireAdmin } from "@/lib/supabase/admin-guard";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { MEDIA_COLUMNS, MEDIA_FOLDERS, type MediaAsset } from "@/components/admin/content/media";
import { MediaLibrary } from "@/components/admin/content/media-library";
import { focusRing } from "@/components/admin/content/ui";
import {
  createMediaAsset,
  replaceMediaFile,
  setMediaDeleted,
  updateMediaAsset,
} from "../actions";

export const metadata: Metadata = { title: "Media library" };
export const dynamic = "force-dynamic";

const FOLDERS = new Set(MEDIA_FOLDERS.map((f) => f.value as string));

export default async function MediaLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string; removed?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const folder = params.folder && FOLDERS.has(params.folder) ? params.folder : "";
  const showRemoved = params.removed === "1";

  const supabase = await createClient();
  let query = supabase
    .from("media_assets")
    .select(MEDIA_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(200);

  query = showRemoved ? query.not("deleted_at", "is", null) : query.is("deleted_at", null);
  if (folder) query = query.eq("folder", folder);

  const { data, error } = await query;
  const assets = (data ?? []) as unknown as MediaAsset[];

  return (
    <AdminPageShell
      title="Media library"
      description="Every image the storefront can use. Upload once here, then pick it from any image field in the content editor."
    >
      <Link
        href="/admin/content"
        className={cn(
          "-mt-4 mb-8 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-ink-600 transition-colors hover:text-wine-700",
          focusRing,
        )}
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
        Content &amp; Banners
      </Link>

      {error && (
        <p className="mb-8 rounded-2xl border border-cream-300 bg-cream-100 px-5 py-4 text-sm text-wine-700">
          The media library could not be loaded: {error.message}
        </p>
      )}

      <MediaLibrary
        assets={assets}
        folder={folder}
        showRemoved={showRemoved}
        createAction={createMediaAsset}
        updateAction={updateMediaAsset}
        replaceAction={replaceMediaFile}
        deleteAction={setMediaDeleted}
      />
    </AdminPageShell>
  );
}
