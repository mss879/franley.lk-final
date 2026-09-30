import { cn } from "@/lib/utils";

/** Endless brand-promise strip. Duplicated once so the -50% loop is seamless. */
export function Marquee({
  items,
  className,
  tone = "light",
}: {
  items: string[];
  className?: string;
  tone?: "light" | "dark";
}) {
  const run = [...items, ...items];
  return (
    <div
      className={cn(
        "group relative flex overflow-hidden border-y",
        tone === "light"
          ? "border-ink-900 bg-ink-900 text-cream-100/85"
          : "border-cream-300 bg-cream-100 text-ink-800",
        className,
      )}
    >
      <div className="animate-marquee flex shrink-0 items-center gap-10 py-4 pr-10 group-hover:[animation-play-state:paused]">
        {run.map((item, i) => (
          <span key={i} className="eyebrow flex shrink-0 items-center gap-10" aria-hidden={i >= items.length}>
            {item}
            <span className="text-champagne-400" aria-hidden>
              &#9670;
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
