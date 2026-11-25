import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight, ImageIcon, ImageOff, Layers, Lock } from "lucide-react";
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
import { HOME_PRODUCT_SECTIONS } from "@/lib/cms/defaults";
import { setBlockPublished } from "./actions";
import { getHomeSections, type HomeSectionUsage } from "./home-sections";

export const metadata: Metadata = { title: "Home page & Banners" };
export const dynamic = "force-dynamic";

/** "home" is what the owner comes here for, so it reads first. */
const PAGE_ORDER = ["home", "global"];

const BANNER_KEYS = new Set(["banner_1", "banner_2"]);
const SECTION_KEYS = new Set<string>(HOME_PRODUCT_SECTIONS.map((s) => s.key));

/**
 * The home page's blocks, grouped the way the owner thinks about the page:
 * the banners at the top, the product sections, then everything else.
 */
const HOME_GROUPS: {
  id: string;
  title: string;
  body: string;
  match: (key: string) => boolean;
}[] = [
  {
    id: "banners",
    title: "Banners",
    body: "The big slides at the top of the home page. Upload a picture, then write the headline, the line under it and the button.",
    match: (key) => BANNER_KEYS.has(key),
  },
  {
    id: "product-sections",
    title: "Product sections",
    body: "Featured, New in and Trending. Write each heading here; the products in each one are a collection — use “Choose products” to pick them and set their order.",
    match: (key) => SECTION_KEYS.has(key),
  },
  {
    id: "other",
    title: "Other sections",
    body: "Category cards, the scrolling strip and the story band.",
    match: (key) => !BANNER_KEYS.has(key) && !SECTION_KEYS.has(key),
  },
];

function imageOf(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const image = (payload as Record<string, unknown>).image;
  return typeof image === "string" && image ? image : null;
}

function BannerThumb({ src }: { src: string | null }) {
  return (
    <div className="relative aspect-[2/1] w-full shrink-0 overflow-hidden rounded-2xl border border-cream-300 bg-cream-100 sm:w-40">
      {src ? (
        // The address may be a site path or a storage URL outside the
        // next/image allowlist; a thumbnail is not worth a render-time throw.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span className="absolute inset-0 grid place-items-center text-ink-400">
          <ImageOff className="h-5 w-5" strokeWidth={1.5} aria-hidden />
        </span>
      )}
    </div>
  );
}

function SectionProducts({ usage }: { usage: HomeSectionUsage }) {
  const c = usage.collection;
  const live = c && c.isActive && c.liveCount > 0;
  return (
    <p className="mt-2 text-sm text-ink-800">
      Products from{" "}
      {c ? (
        <span className="font-medium">“{c.name}”</span>
      ) : (
        <span className="font-medium">/collections/{usage.slug}</span>
      )}
      {c && (
        <span className="text-ink-600">
          {" "}
          · {c.isActive ? `${c.liveCount} live` : "hidden"}
        </span>
      )}
      {!live && (
        <span className="mt-1 block text-xs text-wine-700">
          {c ? "Nothing live in it yet" : "That collection does not exist"}, so this section shows{" "}
          {usage.fallback}.
        </span>
      )}
    </p>
  );
}

function BlockRow({
  block,
  usage,
  thumbnail,
}: {
  block: ContentBlockRow;
  usage?: HomeSectionUsage;
  thumbnail?: boolean;
}) {
  const location = blockLocation(block.page, block.key);
  const fieldCount = parseFields(block.fields).length;
  const editHref = `/admin/content/${block.id}`;

  return (
    <li className="rounded-[--radius-card] border border-cream-300 bg-white transition-colors duration-300 hover:border-champagne-400">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-6">
        {thumbnail && <BannerThumb src={imageOf(block.payload)} />}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={editHref}
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
            {block.is_locked && !usage && !thumbnail && (
              <Pill tone="locked">
                <Lock className="h-3 w-3" strokeWidth={2} aria-hidden />
                Fixed layout
              </Pill>
            )}
          </div>

          <p className="mt-2 text-sm leading-relaxed text-ink-600 text-pretty">
            {location ?? block.help ?? "Part of the storefront."}
          </p>

          {usage ? (
            <SectionProducts usage={usage} />
          ) : (
            <p className="mt-2 text-xs text-ink-600">
              {fieldCount} editable field{fieldCount === 1 ? "" : "s"}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <PublishToggle
            id={block.id}
            published={block.published}
            label={block.label || block.key}
            action={setBlockPublished}
          />
          {usage?.collection && (
            <Link
              href={`/admin/collections/${usage.collection.id}/edit`}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full border border-ink-800/20 px-4 text-xs font-medium text-ink-800 transition-colors hover:border-wine-700 hover:text-wine-700",
                focusRing,
              )}
            >
              <Layers className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
              Choose products
            </Link>
          )}
          <Link
            href={editHref}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-full bg-ink-900 px-4 text-xs font-medium text-cream-50 transition-colors hover:bg-wine-700",
              focusRing,
            )}
          >
            {usage ? "Edit heading" : thumbnail ? "Edit banner" : "Edit"}
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          </Link>
        </div>
      </div>
    </li>
  );
}

export default async function ContentIndexPage() {
  await requireAdmin();

  const supabase = await createClient();
  const [{ data, error }, sections] = await Promise.all([
    supabase
      .from("content_blocks")
      .select(
        "id, page, key, label, help, payload, fields, is_locked, published, position, publish_at, unpublish_at, updated_at",
      )
      .order("page", { ascending: true })
      .order("position", { ascending: true }),
    getHomeSections().catch(() => [] as HomeSectionUsage[]),
  ]);

  const blocks = (data ?? []) as unknown as ContentBlockRow[];

  const pages = [...new Set(blocks.map((b) => b.page))].sort((a, b) => {
    const ai = PAGE_ORDER.indexOf(a);
    const bi = PAGE_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.localeCompare(b);
  });

  // The Trending block arrives with 0020; until then say so rather than
  // leaving the owner looking for a section that is not there.
  const trendingMissing =
    blocks.length > 0 && !blocks.some((b) => b.page === "home" && b.key === "trending");

  return (
    <AdminPageShell
      title="Home page & Banners"
      description="The home page banners, the heading of every section, and which products Featured, New in and Trending show — plus the announcement strip on every page. Change it here and the site updates."
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
          {pages.map((page) => {
            const pageBlocks = blocks.filter((b) => b.page === page);
            return (
              <section key={page} aria-labelledby={`page-${page}`}>
                <div className="flex items-baseline justify-between gap-4 border-b border-cream-300 pb-3">
                  <h2 id={`page-${page}`} className="font-display text-xl text-ink-900">
                    {pageLabel(page)}
                  </h2>
                  <span className="text-xs text-ink-600">
                    {pageBlocks.length} block{pageBlocks.length === 1 ? "" : "s"}
                  </span>
                </div>

                {page === "home" ? (
                  <div className="mt-6 flex flex-col gap-10">
                    {HOME_GROUPS.map((group) => {
                      const groupBlocks = pageBlocks.filter((b) => group.match(b.key));
                      if (groupBlocks.length === 0) return null;
                      return (
                        <div key={group.id} aria-labelledby={`group-${group.id}`} role="group">
                          <h3
                            id={`group-${group.id}`}
                            className="eyebrow text-wine-700"
                          >
                            {group.title}
                          </h3>
                          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-600">
                            {group.body}
                          </p>
                          <ul className="mt-4 flex flex-col gap-3">
                            {groupBlocks.map((block) => (
                              <BlockRow
                                key={block.id}
                                block={block}
                                thumbnail={group.id === "banners"}
                                usage={
                                  group.id === "product-sections"
                                    ? sections.find((s) => s.blockId === block.id)
                                    : undefined
                                }
                              />
                            ))}
                          </ul>
                          {group.id === "product-sections" && trendingMissing && (
                            <p className="mt-3 text-xs leading-relaxed text-ink-600">
                              The Trending section appears here once the database update
                              0020_home_sections.sql has been run.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <ul className="mt-4 flex flex-col gap-3">
                    {pageBlocks.map((block) => (
                      <BlockRow key={block.id} block={block} />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </AdminPageShell>
  );
}
