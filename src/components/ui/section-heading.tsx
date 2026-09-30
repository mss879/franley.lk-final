import Link from "next/link";
import { Eyebrow } from "./eyebrow";
import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  lede,
  action,
  tone = "dark",
  align = "left",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  lede?: string;
  action?: { href: string; label: string };
  tone?: "dark" | "light";
  align?: "left" | "center";
  className?: string;
}) {
  const light = tone === "light";
  return (
    <div
      className={cn(
        "flex flex-col gap-6 md:flex-row md:items-end md:justify-between",
        align === "center" && "md:flex-col md:items-center md:text-center",
        className,
      )}
    >
      <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}>
        {eyebrow && <Eyebrow tone={tone} rule={align === "left"}>{eyebrow}</Eyebrow>}
        <h2
          className={cn(
            "font-display mt-4 text-4xl leading-[1.05] text-balance md:text-5xl",
            light ? "text-cream-100" : "text-ink-900",
          )}
        >
          {title}
        </h2>
        {lede && (
          <p className={cn("mt-4 text-sm leading-relaxed text-pretty md:text-base", light ? "text-cream-100/70" : "text-ink-600")}>
            {lede}
          </p>
        )}
      </div>

      {action && (
        <Link
          href={action.href}
          className={cn(
            "eyebrow group shrink-0 border-b pb-1 transition-colors duration-300 ease-[--ease-lux]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-4",
            light
              ? "focus-on-dark border-cream-100/30 text-cream-100 hover:border-cream-100 ring-offset-ink-900"
              : "border-ink-900/25 text-ink-900 hover:border-ink-900 ring-offset-cream-50",
          )}
        >
          {action.label}
          <span aria-hidden className="ml-2 inline-block transition-transform duration-300 ease-[--ease-lux] group-hover:translate-x-1">
            &rarr;
          </span>
        </Link>
      )}
    </div>
  );
}
