import { cn } from "@/lib/utils";

/** Wide-tracked small-caps label. Every major section opens with one. */
export function Eyebrow({
  children,
  className,
  rule = false,
  tone = "dark",
}: {
  children: React.ReactNode;
  className?: string;
  /** Leading hairline rule, as on the reference boards. */
  rule?: boolean;
  tone?: "dark" | "light";
}) {
  return (
    <span
      className={cn(
        "eyebrow inline-flex items-center gap-3",
        tone === "dark" ? "text-wine-700" : "text-champagne-300",
        className,
      )}
    >
      {rule && (
        <span
          aria-hidden
          className={cn("h-px w-8", tone === "dark" ? "bg-wine-700/40" : "bg-champagne-300/50")}
        />
      )}
      {children}
    </span>
  );
}
