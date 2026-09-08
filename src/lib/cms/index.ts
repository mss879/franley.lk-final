import "server-only";
import { DEFAULT_HOME, type HomeContent } from "./defaults";
import { isLive } from "@/lib/data";
import type { HeroSlide } from "@/components/site/hero-slider";
import type { ShowcaseCard } from "@/components/site/category-showcase";
import type { AnnouncementContent } from "@/components/site/announcement-bar";

/**
 * Storefront content. Deep-merges CMS overrides onto the defaults so a
 * partially-filled block still renders a complete page.
 */
function deepMerge<T>(base: T, override: unknown): T {
  if (override === null || override === undefined) return base;
  if (typeof base !== "object" || base === null || Array.isArray(base)) {
    return override as T;
  }
  if (typeof override !== "object" || Array.isArray(override)) return base;

  const out = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
    if (value === null || value === undefined || value === "") continue;
    out[key] = key in out ? deepMerge(out[key], value) : value;
  }
  return out as T;
}

/**
 * Each hero banner is its own `banner_1` / `banner_2` block rather than a list
 * inside one block. That gives the shop owner a plainly-labelled form per
 * banner, and — because publishing and scheduling live on the row — lets them
 * run a single banner, or queue a seasonal one, without touching the other.
 */
const BANNER_KEYS = ["banner_1", "banner_2"] as const;

function toSlide(payload: unknown, fallback: HeroSlide): HeroSlide {
  return deepMerge(fallback, payload);
}

function toShowcaseCards(
  blocks: Record<string, unknown>,
  fallback: ShowcaseCard[],
): ShowcaseCard[] {
  const showcase = blocks.showcase as Record<string, unknown> | undefined;
  if (!showcase) return fallback;

  const cards = fallback.map((card, i) =>
    deepMerge(card, showcase[`card${i + 1}`]),
  );
  return cards.filter((c) => c.image && c.name);
}

export async function getHomeContent(): Promise<HomeContent> {
  if (!isLive()) return DEFAULT_HOME;

  try {
    const { getContentBlocksLive } = await import("./supabase-source");
    const blocks = await getContentBlocksLive("home");

    // A banner the admin unpublished simply drops out of the rotation.
    const published = BANNER_KEYS.filter((k) => k in blocks);
    const slides =
      published.length > 0
        ? published.map((k, i) => toSlide(blocks[k], DEFAULT_HOME.heroSlides[i] ?? DEFAULT_HOME.heroSlides[0]))
        : DEFAULT_HOME.heroSlides;

    const showcase = deepMerge(DEFAULT_HOME.showcase, blocks.showcase);

    return {
      ...deepMerge(DEFAULT_HOME, blocks),
      heroSlides: slides.filter((s) => s.image),
      showcase: { ...showcase, cards: toShowcaseCards(blocks, DEFAULT_HOME.showcase.cards) },
    };
  } catch {
    return DEFAULT_HOME;
  }
}

/**
 * The announcement strip. Unlike the home blocks there is no default — an
 * announcement nobody wrote should not appear, so `null` means "render nothing".
 */
export async function getAnnouncement(): Promise<AnnouncementContent | null> {
  if (!isLive()) return null;
  try {
    const { getContentBlocksLive } = await import("./supabase-source");
    const blocks = await getContentBlocksLive("global");
    const announcement = blocks.announcement as AnnouncementContent | undefined;
    return announcement?.text ? announcement : null;
  } catch {
    return null;
  }
}

export { DEFAULT_HOME };
export type { HomeContent };
