"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  blockLocation,
  blockStorefrontHref,
  buildPayload,
  initialValue,
  pageLabel,
  type ActionState,
  type ContentBlockRow,
  type FieldDescriptor,
} from "./types";
import { BlockFieldControl } from "./block-fields";
import { BlockPreview, hasPreview, useDebounced } from "./block-preview";
import { ScheduleFields } from "./schedule-fields";
import { Pill, StatusMessage, focusRing } from "./ui";

export function BlockForm({
  block,
  fields,
  action,
}: {
  block: ContentBlockRow;
  fields: FieldDescriptor[];
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [values, setValues] = useState<Record<string, string | boolean>>(() => {
    const out: Record<string, string | boolean> = {};
    for (const field of fields) out[field.name] = initialValue(block.payload, field);
    return out;
  });
  const [dirty, setDirty] = useState(false);
  const [state, formAction, pending] = useActionState(action, null);

  const set = (name: string) => (next: string | boolean) => {
    setValues((prev) => ({ ...prev, [name]: next }));
    setDirty(true);
  };

  // Stringified so the debounce compares by value, not by object identity —
  // the payload is rebuilt on every render.
  const payloadJson = useMemo(
    () => JSON.stringify(buildPayload(fields, values, block.payload) ?? null),
    [fields, values, block.payload],
  );
  const debouncedJson = useDebounced(payloadJson);
  const previewPayload = useMemo(() => JSON.parse(debouncedJson) as unknown, [debouncedJson]);

  const showPreview = hasPreview(block.page, block.key);
  const location = blockLocation(block.page, block.key);

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <input type="hidden" name="id" value={block.id} />

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/admin/content"
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-ink-600 transition-colors hover:text-wine-700",
            focusRing,
          )}
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
          All content
        </Link>
        <Pill>{pageLabel(block.page)}</Pill>
        {block.is_locked && (
          <Pill tone="locked">
            <Lock className="h-3 w-3" strokeWidth={2} aria-hidden />
            Fixed layout
          </Pill>
        )}
        <Link
          href={blockStorefrontHref(block.page)}
          target="_blank"
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-ink-600 transition-colors hover:text-wine-700",
            focusRing,
          )}
        >
          View live page
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
        </Link>
      </div>

      {location && <p className="-mt-4 text-sm text-ink-600">{location}.</p>}

      <div className={cn("grid gap-8", showPreview && "lg:grid-cols-12")}>
        {/* ---- The form itself ---- */}
        <div className={cn("flex flex-col gap-8", showPreview && "lg:col-span-7")}>
          <fieldset className="rounded-[--radius-card] border border-cream-300 bg-white p-6">
            <legend className="eyebrow px-2 text-wine-700">Content</legend>
            {fields.length === 0 ? (
              <p className="text-sm text-ink-600">
                This block has no editable fields yet. A developer needs to describe its fields
                before it can be edited here.
              </p>
            ) : (
              <div className="flex flex-col gap-7">
                {fields.map((field) => (
                  <BlockFieldControl
                    key={field.name}
                    field={field}
                    value={values[field.name] ?? ""}
                    onChange={set(field.name)}
                    error={state?.fieldErrors?.[field.name] ?? null}
                  />
                ))}
              </div>
            )}
          </fieldset>

          <ScheduleFields
            published={block.published}
            publishAt={block.publish_at}
            unpublishAt={block.unpublish_at}
            onDirty={() => setDirty(true)}
          />

          {block.is_locked && (
            <p className="flex items-start gap-2.5 rounded-2xl border border-cream-300 bg-cream-100 px-4 py-3 text-xs leading-relaxed text-ink-600">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
              <span>
                The wording and the images here are yours to change. Which fields exist, and where
                this block sits on the site, are fixed — they are tied to the page design.
              </span>
            </p>
          )}
        </div>

        {/* ---- Live preview ---- */}
        {showPreview && (
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-8">
              <BlockPreview page={block.page} blockKey={block.key} payload={previewPayload} />
            </div>
          </div>
        )}
      </div>

      {/* ---- Save bar ---- */}
      <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center justify-between gap-4 border-t border-cream-300 bg-cream-50/95 px-1 py-4 backdrop-blur">
        <div className="min-h-[1.25rem]">
          {state ? (
            <StatusMessage state={state} />
          ) : (
            <p aria-live="polite" className="text-sm text-ink-600">
              {dirty ? "Unsaved changes." : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending || fields.length === 0}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </form>
  );
}
