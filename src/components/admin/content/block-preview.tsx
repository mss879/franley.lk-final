"use client";

import { Component, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Monitor, Smartphone, TriangleAlert } from "lucide-react";
import { HeroSlider } from "@/components/site/hero-slider";
import { CategoryShowcase } from "@/components/site/category-showcase";
import { EditorialBand } from "@/components/site/editorial-band";
import { Marquee } from "@/components/ui/marquee";
import { SectionHeading } from "@/components/ui/section-heading";
import { AnnouncementBar, type AnnouncementContent } from "@/components/site/announcement-bar";
import { DEFAULT_HOME, withoutRetiredImage, type HomeContent } from "@/lib/cms/defaults";
import { cn } from "@/lib/utils";
import { focusRing } from "./ui";

/**
 * A read-only render of the real storefront component, at storefront width,
 * scaled down to fit the editor column. Same merge rule as
 * src/lib/cms/index.ts, so what is shown here is what the site will show:
 * an emptied field falls back to the built-in default rather than blanking.
 */

function deepMerge<T>(base: T, override: unknown): T {
  if (override === null || override === undefined) return base;
  if (typeof base !== "object" || base === null || Array.isArray(base)) return override as T;
  if (typeof override !== "object" || Array.isArray(override)) return base;

  const out = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
    if (value === null || value === undefined || value === "") continue;
    out[key] = key in out ? deepMerge(out[key], value) : value;
  }
  return out as T;
}

type PreviewSpec = {
  /** Dark bands need a dark backdrop behind the scaled frame. */
  dark: boolean;
  render: (payload: unknown) => React.ReactNode;
};

function bannerPreview(index: number): PreviewSpec {
  return {
    dark: true,
    render: (payload) => {
      const fallback = DEFAULT_HOME.heroSlides[index] ?? DEFAULT_HOME.heroSlides[0];
      return <HeroSlider slides={[deepMerge(fallback, withoutRetiredImage(payload))]} />;
    },
  };
}

function headingPreview(slot: "collection" | "lookbook"): PreviewSpec {
  return {
    dark: false,
    render: (payload) => {
      const c = deepMerge(DEFAULT_HOME[slot], payload) as HomeContent["collection"];
      return (
        <div className={cn("px-10 py-16", slot === "lookbook" ? "bg-cream-100" : "bg-cream-50")}>
          <SectionHeading
            eyebrow={c.eyebrow}
            title={c.title}
            lede={c.lede}
            action={{ href: "/shop", label: "View all" }}
          />
        </div>
      );
    },
  };
}

const PREVIEWS: Record<string, PreviewSpec> = {
  // Each banner block previews as a single-slide version of the real slider.
  "home:banner_1": bannerPreview(0),
  "home:banner_2": bannerPreview(1),
  "home:showcase": {
    dark: true,
    render: (payload) => <CategoryShowcase content={deepMerge(DEFAULT_HOME.showcase, payload)} />,
  },
  "home:editorial": {
    dark: true,
    render: (payload) => <EditorialBand content={deepMerge(DEFAULT_HOME.editorial, payload)} />,
  },
  "home:marquee": {
    dark: true,
    render: (payload) => (
      <Marquee items={(deepMerge(DEFAULT_HOME.marquee, payload) as string[]) ?? []} tone="light" />
    ),
  },
  "home:collection": headingPreview("collection"),
  "home:lookbook": headingPreview("lookbook"),
  "global:announcement": {
    dark: true,
    render: (payload) => {
      // The real strip renders nothing without text; the editor still needs
      // something on screen, so an untouched block previews as a placeholder.
      const p = (payload ?? {}) as AnnouncementContent;
      return <AnnouncementBar content={{ ...p, text: p.text || "Announcement" }} />;
    },
  },
};

export function hasPreview(page: string, key: string) {
  return `${page}:${key}` in PREVIEWS;
}

const WIDTHS = { desktop: 1280, mobile: 420 } as const;
type Device = keyof typeof WIDTHS;

export function BlockPreview({
  page,
  blockKey,
  payload,
}: {
  page: string;
  blockKey: string;
  payload: unknown;
}) {
  const spec = PREVIEWS[`${page}:${blockKey}`];
  const [device, setDevice] = useState<Device>("desktop");
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [height, setHeight] = useState(320);

  const width = WIDTHS[device];

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const update = () => {
      const next = Math.min(1, outer.clientWidth / width);
      setScale(next);
      // offsetHeight is the pre-transform layout height, so the wrapper can be
      // given the exact post-scale height and nothing is clipped or padded.
      setHeight(inner.offsetHeight * next);
    };

    const observer = new ResizeObserver(update);
    observer.observe(outer);
    observer.observe(inner);
    update();
    return () => observer.disconnect();
  }, [width]);

  if (!spec) return null;

  return (
    <section aria-labelledby="preview-heading" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 id="preview-heading" className="eyebrow text-champagne-700">
            Live preview
          </h2>
          <p className="mt-1 text-xs text-ink-600">
            Updates as you type. Not saved until you press Save changes.
          </p>
        </div>
        <div
          role="group"
          aria-label="Preview width"
          className="flex items-center gap-1 rounded-full border border-cream-300 bg-white p-1"
        >
          {(["desktop", "mobile"] as const).map((d) => {
            const Icon = d === "desktop" ? Monitor : Smartphone;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDevice(d)}
                aria-pressed={device === d}
                className={cn(
                  "inline-flex h-8 items-center gap-2 rounded-full px-3 text-xs capitalize transition-colors",
                  device === d ? "bg-ink-900 text-cream-50" : "text-ink-600 hover:text-wine-700",
                  focusRing,
                )}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                {d}
              </button>
            );
          })}
        </div>
      </div>

      <div
        ref={outerRef}
        className={cn(
          "overflow-hidden rounded-[--radius-card] border border-cream-300",
          spec.dark ? "bg-ink-950" : "bg-cream-50",
        )}
      >
        <div style={{ height }} className="relative">
          <div
            ref={innerRef}
            aria-hidden
            // The preview is decorative duplication of the form's own content;
            // hiding it from the accessibility tree keeps the editor's reading
            // order and tab order clean.
            style={{ width, transform: `scale(${scale})`, transformOrigin: "top left" }}
            // The hero is built to sit under a transparent site header (-mt-20) and to
            // fill a viewport (min-h-dvh); neither is true inside a preview frame.
            className="pointer-events-none select-none [&_section]:mt-0 [&_section]:min-h-0"
          >
            <PreviewBoundary payloadKey={JSON.stringify(payload)}>
              {spec.render(payload)}
            </PreviewBoundary>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * A bad image address makes next/image throw at render. Catching it keeps the
 * editor usable — and tells the client which field to fix.
 */
class PreviewBoundary extends Component<
  { children: React.ReactNode; payloadKey: string },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(prev: { payloadKey: string }) {
    if (this.state.failed && prev.payloadKey !== this.props.payloadKey) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="flex items-center gap-3 bg-cream-100 px-10 py-12 text-ink-800">
          <TriangleAlert className="h-5 w-5 shrink-0 text-wine-700" strokeWidth={1.5} aria-hidden />
          <p className="text-sm">
            This preview could not be drawn. Usually an image address the site cannot load — check
            the image fields above.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Debounces the payload so typing does not re-render the frame on every keystroke. */
export function useDebounced<T>(value: T, delay = 180) {
  const [debounced, setDebounced] = useState(value);
  const set = useCallback((v: T) => setDebounced(v), []);
  useEffect(() => {
    const t = setTimeout(() => set(value), delay);
    return () => clearTimeout(t);
  }, [value, delay, set]);
  return debounced;
}
