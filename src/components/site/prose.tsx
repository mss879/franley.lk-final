import { cn } from "@/lib/utils";

/** Long-form copy: policies, guides, anything mostly words. */
export function Prose({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "max-w-2xl text-sm leading-[1.9] text-ink-600 text-pretty md:text-base",
        "[&_h2]:font-display [&_h2]:mt-12 [&_h2]:text-2xl [&_h2]:leading-tight [&_h2]:text-ink-900 first:[&_h2]:mt-0",
        "[&_h3]:font-display [&_h3]:mt-8 [&_h3]:text-lg [&_h3]:text-ink-900",
        "[&_p]:mt-4",
        "[&_ul]:mt-4 [&_ul]:space-y-2.5 [&_ul]:pl-0",
        "[&_li]:relative [&_li]:pl-6",
        "[&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:top-[0.7em] [&_li]:before:h-1 [&_li]:before:w-1 [&_li]:before:rounded-full [&_li]:before:bg-wine-700",
        "[&_a]:text-wine-700 [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-wine-600",
        "focus-visible:[&_a]:outline-none focus-visible:[&_a]:ring-2 focus-visible:[&_a]:ring-[var(--focus-ring)] focus-visible:[&_a]:ring-offset-2",
        "[&_strong]:font-medium [&_strong]:text-ink-900",
        className,
      )}
    >
      {children}
    </div>
  );
}
