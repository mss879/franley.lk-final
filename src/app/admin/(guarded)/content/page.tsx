import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight, ImageIcon, Lock } from "lucide-react";
import { AdminPageShell } from "@/components/admin/page-shell";
import { requireAdmin } from "@/lib/supabase/admin-guard";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import {
  blockLocation,
  pageLabel,
  parseFields,
  type ContentBlockRow,
} from "@/components/admin/content/types";
import { EmptyState, Pill, focusRing } from "@/components/admin/content/ui";
import { PublishToggle, ScheduleStatus } from "@/components/admin/content/block-row-controls";
import { setBlockPublished } from "./actions";

export const metadata: Metadata = { title: "Content & Banners" };
export const dynamic = "force-dynamic";

/** "global" is the strip above everything, so it reads first. */
const PAGE_ORDER = ["global", "home"];

export default async function ContentIndexPage() {
  await requireAdmin();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_blocks")
    .select(
      "id, page, key, label, help, payload, fields, is_locked, published, position, publish_at, unpublish_at, updated_at",
    )
    .order("page", { ascending: true })
    .order("position", { ascending: true });

  const blocks = (data ?? []) as unknown as ContentBlockRow[];

  const pages = [...new Set(blocks.map((b) => b.page))].sort((a, b) => {
    const ai = PAGE_ORDER.indexOf(a);
    const bi = PAGE_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.localeCompare(b);
  });

  return (
    <AdminPageShell
      title="Content & Banners"
      description="Everything on the storefront that is words or pictures rather than products. Change it here and the site updates — no developer needed."
      action={{ href: "/admin/content/media", label: "Media library" }}
    >
      {error && (
        <p className="mb-8 rounded-2xl border border-cream-300 bg-cream-100 px-5 py-4 text-sm text-wine-700">
          The content could not be loaded: {error.message}
        </p>
      )}

      {blocks.length === 0 ? (
        <EmptyState
          title="No editable content yet"
          body="Once the content blocks are seeded into the database, every band of the storefront shows up here as a labelled form."
          action={
            <Link
              href="/admin/content/media"
              className={cn(
                "inline-flex h-11 items-center gap-2 rounded-full bg-ink-900 px-6 text-sm font-medium text-cream-50 transition-colors hover:bg-wine-700",
                focusRing,
              )}
            >
              <ImageIcon className="h-4 w-4" strokeWidth={1.5} aria-hidden />
              Go to the media library
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-12">
          {pages.map((page) => (
            <section key={page} aria-labelledby={`page-${page}`}>
              <div className="flex items-baseline justify-between gap-4 border-b border-cream-300 pb-3">
                <h2 id={`page-${page}`} className="font-display text-xl text-ink-900">
                  {pageLabel(page)}
                </h2>
                <span className="text-xs text-ink-600">
                  {blocks.filter((b) => b.page === page).length} block
                  {blocks.filter((b) => b.page === page).length === 1 ? "" : "s"}
                </span>
              </div>

              <ul className="mt-4 flex flex-col gap-3">
                {blocks
                  .filter((b) => b.page === page)
                  .map((block) => {
                    const location = blockLocation(block.page, block.key);
                    const fieldCount = parseFields(block.fields).length;

                    return (
                      <li
                        key={block.id}
                        className="rounded-[--radius-card] border border-cream-300 bg-white transition-colors duration-300 hover:border-champagne-400"
                      >
                        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-6">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Link
                                href={`/admin/content/${block.id}`}
                                className={cn(
                                  "font-display text-lg text-ink-900 transition-colors hover:text-wine-700",
                                  focusRing,
                                )}
                              >
                                {block.label || block.key}
                              </Link>
                              <ScheduleStatus
                                published={block.published}
                                publishAt={block.publish_at}
                                unpublishAt={block.unpublish_at}
                              />
                              {block.is_locked && (
                                <Pill tone="locked">
                                  <Lock className="h-3 w-3" strokeWidth={2} aria-hidden />
                                  Fixed layout
                                </Pill>
                              )}
                            </div>

                            <p className="mt-2 text-sm leading-relaxed text-ink-600 text-pretty">
                              {location ?? block.help ?? "Part of the storefront."}
                            </p>

                            <p className="mt-2 text-xs text-ink-600">
                              {fieldCount} editable field{fieldCount === 1 ? "" : "s"}
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <PublishToggle
                              id={block.id}
                              published={block.published}
                              label={block.label || block.key}
                              action={setBlockPublished}
                            />
                            <Link
                              href={`/admin/content/${block.id}`}
                              className={cn(
                                "inline-flex h-9 items-center gap-1.5 rounded-full bg-ink-900 px-4 text-xs font-medium text-cream-50 transition-colors hover:bg-wine-700",
                                focusRing,
                              )}
                            >
                              Edit
                              <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                            </Link>
                          </div>
                        </div>
                      </li>
                    );
                  })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </AdminPageShell>
  );
}
