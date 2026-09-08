"use client";

import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { focusRing, inputPill } from "./ui";
import { useMounted } from "./use-mounted";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** ISO → the value a datetime-local input wants, in the admin's own timezone. */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIso(local: string) {
  if (!local) return "";
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function pretty(local: string) {
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(d);
}

/**
 * The publish window, in plain language. The database enforces the same window
 * in its read policy (0004), so "not yet showing" really means invisible.
 *
 * The datetime-local inputs are read in the admin's own timezone and converted
 * to ISO in the browser — doing it on the server would silently apply the
 * server's timezone instead.
 */
export function ScheduleFields({
  published,
  publishAt,
  unpublishAt,
  onDirty,
}: {
  published: boolean;
  publishAt: string | null;
  unpublishAt: string | null;
  onDirty?: () => void;
}) {
  const mounted = useMounted();
  const [live, setLive] = useState(published);
  const [fromEdit, setFromEdit] = useState<string | null>(null);
  const [untilEdit, setUntilEdit] = useState<string | null>(null);

  // The stored instants only become wall-clock text once we are in the
  // browser, so the server pass and the hydrating pass render the same empty
  // inputs and no value is patched in behind React's back.
  const from = fromEdit ?? (mounted ? toLocalInput(publishAt) : "");
  const until = untilEdit ?? (mounted ? toLocalInput(unpublishAt) : "");

  const change = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    onDirty?.();
  };

  const sentence = !live
    ? "Hidden. Nothing from this block appears on the site."
    : from && until
      ? `Shows from ${pretty(from)} until ${pretty(until)}.`
      : from
        ? `Shows from ${pretty(from)} onwards.`
        : until
          ? `Shows now, and stops on ${pretty(until)}.`
          : "Shows on the site right now, with no end date.";

  const invalidOrder = Boolean(from && until && new Date(until) <= new Date(from));

  return (
    <fieldset className="rounded-[--radius-card] border border-cream-300 bg-white p-6">
      <legend className="eyebrow px-2 text-wine-700">Visibility &amp; schedule</legend>

      <div className="flex items-start gap-3">
        <input
          id="published"
          name="published"
          type="checkbox"
          checked={live}
          onChange={(e) => {
            setLive(e.target.checked);
            onDirty?.();
          }}
          className={cn("mt-0.5 h-4 w-4 shrink-0 accent-wine-700", focusRing)}
        />
        <div>
          <label htmlFor="published" className="text-sm font-medium text-ink-800">
            Show this on the site
          </label>
          <p className="mt-1 text-xs leading-relaxed text-ink-600">
            Turn this off to hide the block without deleting anything you have written.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="publish-at" className="text-sm font-medium text-ink-800">
            Start showing on
          </label>
          <p className="text-xs text-ink-600">Leave empty to start immediately.</p>
          <input
            id="publish-at"
            type="datetime-local"
            value={from}
            onChange={(e) => change(setFromEdit)(e.target.value)}
            className={inputPill}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="unpublish-at" className="text-sm font-medium text-ink-800">
            Stop showing on
          </label>
          <p className="text-xs text-ink-600">Leave empty to keep it up indefinitely.</p>
          <input
            id="unpublish-at"
            type="datetime-local"
            value={until}
            onChange={(e) => change(setUntilEdit)(e.target.value)}
            aria-invalid={invalidOrder || undefined}
            className={inputPill}
          />
        </div>
      </div>

      {/* What actually reaches the server: UTC instants, not wall-clock text. */}
      <input type="hidden" name="publish_at" value={toIso(from)} />
      <input type="hidden" name="unpublish_at" value={toIso(until)} />

      <p
        aria-live="polite"
        className={cn(
          "mt-6 flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm",
          invalidOrder ? "bg-wine-700/8 text-wine-700" : "bg-cream-100 text-ink-800",
        )}
      >
        <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
        <span>
          {invalidOrder
            ? "The end date has to come after the start date."
            : sentence}
        </span>
      </p>

      {(from || until) && (
        <button
          type="button"
          onClick={() => {
            setFromEdit("");
            setUntilEdit("");
            onDirty?.();
          }}
          className={cn(
            "mt-4 rounded-full px-3 py-1.5 text-xs text-ink-600 underline-offset-4 transition-colors hover:text-wine-700 hover:underline",
            focusRing,
          )}
        >
          Clear both dates
        </button>
      )}
    </fieldset>
  );
}
