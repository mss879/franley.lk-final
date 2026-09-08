import { cn } from "@/lib/utils";

/** Shared control chrome for the CMS screens. Pills on light cream, hairlines only. */

export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50";

export const inputBase =
  "w-full border border-cream-300 bg-white text-sm text-ink-800 placeholder:text-ink-600 " +
  "transition-colors duration-200 hover:border-champagne-400 focus:border-champagne-400 " +
  focusRing;

export const inputPill = cn(inputBase, "h-11 rounded-full px-5");
export const inputArea = cn(inputBase, "rounded-2xl px-5 py-3.5 leading-relaxed");
export const selectPill = cn(inputBase, "h-11 rounded-full px-5 pr-10 appearance-none");

export const card = "rounded-[--radius-card] border border-cream-300 bg-white";

export function FieldShell({
  htmlFor,
  label,
  help,
  required,
  error,
  hint,
  children,
}: {
  htmlFor: string;
  label: string;
  help?: string | null;
  required?: boolean;
  error?: string | null;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={htmlFor} className="text-sm font-medium text-ink-800">
          {label}
          {required && (
            <span className="ml-1 text-wine-700" aria-hidden>
              *
            </span>
          )}
          {required && <span className="sr-only"> (required)</span>}
        </label>
        {hint}
      </div>
      {help && <p className="text-xs leading-relaxed text-ink-600">{help}</p>}
      {children}
      {error && (
        <p id={`${htmlFor}-error`} className="text-xs text-wine-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function StatusMessage({
  state,
}: {
  state: { ok: boolean; message: string } | null;
}) {
  return (
    <p
      aria-live="polite"
      className={cn(
        "text-sm",
        !state ? "text-ink-600" : state.ok ? "text-wine-700" : "text-wine-700",
      )}
    >
      {state?.message ?? ""}
    </p>
  );
}

export function Pill({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "live" | "off" | "scheduled" | "locked";
  children: React.ReactNode;
}) {
  const tones = {
    neutral: "border-cream-300 bg-cream-100 text-ink-600",
    live: "border-wine-700/25 bg-wine-700/8 text-wine-700",
    off: "border-cream-300 bg-cream-200 text-ink-600",
    scheduled: "border-champagne-400/50 bg-champagne-100 text-champagne-600",
    locked: "border-cream-300 bg-cream-100 text-ink-400",
  } as const;
  return (
    <span
      className={cn(
        "eyebrow inline-flex items-center gap-1.5 rounded-full border px-3 py-1",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-[--radius-card] border border-dashed border-cream-300 bg-cream-100/60 px-8 py-16 text-center">
      <h2 className="font-display text-2xl text-ink-900">{title}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-600 text-pretty">{body}</p>
      {action && <div className="mt-7 flex justify-center">{action}</div>}
    </div>
  );
}
