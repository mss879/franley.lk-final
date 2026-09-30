import { cn } from "@/lib/utils";

type Tone = "dark" | "light";

/**
 * `animate-pulse` is the only motion here, so the blanket reduced-motion rule
 * in globals.css stills it without a second, competing declaration.
 */
export function Skeleton({
  className,
  tone = "dark",
}: {
  className?: string;
  /** `light` for bars sitting on a dark band. */
  tone?: Tone;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse rounded-full",
        // cream-300 is the hairline tone and all but vanishes on the cream
        // page once `animate-pulse` halves it, so bars use warm ink instead.
        tone === "dark" ? "bg-ink-400/30" : "bg-cream-100/20",
        className,
      )}
    />
  );
}

/**
 * Stacked bars standing in for wrapped body copy. Each bar sits centred in a
 * box the height of the real line, so the swap to live text does not shift.
 */
export function SkeletonText({
  lines = 2,
  tone,
  className,
  lineClassName = "h-5",
}: {
  lines?: number;
  tone?: Tone;
  className?: string;
  /** Height of one line box in the copy being replaced. */
  lineClassName?: string;
}) {
  return (
    <div className={className}>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={cn("flex items-center", lineClassName)}>
          <Skeleton tone={tone} className={cn("h-2.5", i === lines - 1 ? "w-3/5" : "w-full")} />
        </div>
      ))}
    </div>
  );
}

/**
 * Wraps a whole loading screen. Without the announcement a screen-reader user
 * gets silence while the page sits empty, since every bar is `aria-hidden`.
 */
export function LoadingScreen({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div aria-busy="true">
      <span role="status" className="sr-only">
        {label}
      </span>
      {children}
    </div>
  );
}
