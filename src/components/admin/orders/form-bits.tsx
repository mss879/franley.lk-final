"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/app/admin/(guarded)/orders/actions";

export const inputClass =
  "h-11 w-full rounded-full border border-cream-300 bg-white px-4 text-sm text-ink-800 " +
  "placeholder:text-ink-600 focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50";

export const textareaClass =
  "w-full rounded-2xl border border-cream-300 bg-white px-4 py-3 text-sm leading-relaxed text-ink-800 " +
  "placeholder:text-ink-600 focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50";

export const labelClass = "eyebrow block text-ink-600";

export function SubmitButton({
  children,
  disabled,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} {...props}>
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}

/** Every mutation reports back here, including the database's own refusal
 *  message when it rejects a transition. */
export function ActionFeedback({ state, className }: { state: ActionState; className?: string }) {
  return (
    <div aria-live="polite" className={cn("min-h-5", className)}>
      {state && (
        <p className={cn("text-xs leading-relaxed", state.ok ? "text-wine-700" : "text-wine-800")}>
          {!state.ok && <span className="font-medium">Not done — </span>}
          {state.message}
        </p>
      )}
    </div>
  );
}
