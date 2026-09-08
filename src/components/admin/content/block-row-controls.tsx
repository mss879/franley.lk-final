"use client";

import { useActionState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActionState } from "./types";
import { Pill, focusRing } from "./ui";
import { useNow } from "./use-mounted";

/**
 * Publish/hide without opening the block. The label says what pressing it will
 * do, and the result is announced for screen readers.
 */
export function PublishToggle({
  id,
  published,
  label,
  action,
}: {
  id: string;
  published: boolean;
  label: string;
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const Icon = published ? EyeOff : Eye;

  return (
    <form action={formAction} className="contents">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="published" value={published ? "false" : "true"} />
      <button
        type="submit"
        disabled={pending}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-full border border-cream-300 px-4 text-xs font-medium text-ink-800 transition-colors hover:border-wine-700 hover:text-wine-700 disabled:opacity-50",
          focusRing,
        )}
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <Icon className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
        )}
        {published ? "Hide" : "Show"}
        <span className="sr-only"> {label}</span>
      </button>
      <span className="sr-only" aria-live="polite">
        {state?.message ?? ""}
      </span>
    </form>
  );
}

function format(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(d);
}

/**
 * Whether the block is on the site right now, and its schedule window, both in
 * the viewer's own clock. Held back until after hydration so the server pass
 * and the client pass cannot disagree about the time.
 */
export function ScheduleStatus({
  published,
  publishAt,
  unpublishAt,
}: {
  published: boolean;
  publishAt: string | null;
  unpublishAt: string | null;
}) {
  const now = useNow();

  if (!published) return <Pill tone="off">Hidden</Pill>;
  // 0 until hydration: the server has no business guessing the viewer's clock.
  if (now === 0) return <Pill tone="live">Published</Pill>;

  const from = publishAt ? new Date(publishAt).getTime() : null;
  const until = unpublishAt ? new Date(unpublishAt).getTime() : null;

  if (from && from > now) return <Pill tone="scheduled">Starts {format(publishAt!)}</Pill>;
  if (until && until <= now) return <Pill tone="off">Finished</Pill>;
  if (until) return <Pill tone="live">Showing until {format(unpublishAt!)}</Pill>;
  return <Pill tone="live">Showing</Pill>;
}
