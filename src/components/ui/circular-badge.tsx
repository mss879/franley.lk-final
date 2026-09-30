import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Board 1's "EXPLORE MORE • EXPLORE MORE •" seal: text running around a
 * circular path, slowly rotating, with an arrow in a solid centre disc.
 * The ring rotates; the disc stays still so the arrow reads upright.
 */
export function CircularBadge({
  href,
  label = "Explore More",
  className,
  size = 132,
}: {
  href: string;
  label?: string;
  className?: string;
  size?: number;
}) {
  const text = `${label} • ${label} • `;
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "group relative grid place-items-center rounded-full",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-4 focus-on-dark focus-visible:ring-offset-ink-900",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full animate-spin-slow"
        aria-hidden
      >
        <defs>
          <path id="franley-badge-arc" d="M 50,50 m -37,0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0" fill="none" />
        </defs>
        <text
          className="fill-cream-100"
          style={{ fontSize: "8.4px", letterSpacing: "0.3em", textTransform: "uppercase" }}
        >
          <textPath href="#franley-badge-arc" startOffset="0">
            {text}
          </textPath>
        </text>
      </svg>

      <span
        className={cn(
          "relative grid h-[42%] w-[42%] place-items-center rounded-full bg-cream-100 text-ink-900",
          "transition-transform duration-500 ease-[--ease-lux] group-hover:scale-110",
        )}
      >
        <ArrowRight className="h-1/2 w-1/2" strokeWidth={1.5} aria-hidden />
      </span>
    </Link>
  );
}
