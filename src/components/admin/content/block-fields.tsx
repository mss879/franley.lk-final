"use client";

import { useId, useState } from "react";
import Image from "next/image";
import { ImagePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { isImageField, isLinkField, type FieldDescriptor } from "./types";
import { mediaUrl, type MediaAsset } from "./media";
import { MediaPickerDialog } from "./media-picker";
import { FieldShell, focusRing, inputArea, inputPill, selectPill } from "./ui";

export const FIELD_INPUT_PREFIX = "f:";

const LINK_HELP = "Start with / for a page on this site, or https:// for somewhere else.";

export function BlockFieldControl({
  field,
  value,
  onChange,
  error,
}: {
  field: FieldDescriptor;
  value: string | boolean;
  onChange: (next: string | boolean) => void;
  error?: string | null;
}) {
  const reactId = useId();
  const id = `${reactId}-${field.name.replace(/[^a-zA-Z0-9]/g, "-")}`;
  const name = `${FIELD_INPUT_PREFIX}${field.name}`;
  const described = error ? `${id}-error` : undefined;
  const text = typeof value === "string" ? value : "";

  if (field.type === "boolean") {
    const on = value === true;
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-3">
          <input
            id={id}
            name={name}
            type="checkbox"
            checked={on}
            onChange={(e) => onChange(e.target.checked)}
            className={cn("mt-0.5 h-4 w-4 shrink-0 accent-ink-900", focusRing)}
          />
          <label htmlFor={id} className="text-sm font-medium text-ink-800">
            {field.label}
          </label>
        </div>
        {field.help && <p className="pl-7 text-xs leading-relaxed text-ink-600">{field.help}</p>}
        {error && (
          <p id={`${id}-error`} className="pl-7 text-xs text-wine-700">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (isImageField(field.type)) {
    return (
      <ImageField
        id={id}
        name={name}
        field={field}
        value={text}
        onChange={onChange}
        error={error}
      />
    );
  }

  if (field.type === "string_list") {
    const lines = text.split("\n").filter((l) => l.trim()).length;
    const over = field.maxItems ? lines > field.maxItems : false;
    return (
      <FieldShell
        htmlFor={id}
        label={field.label}
        help={field.help ?? "One per line."}
        required={field.required}
        error={error}
        hint={
          <span className={cn("text-xs", over ? "text-wine-700" : "text-ink-600")}>
            {lines}
            {field.maxItems ? ` / ${field.maxItems}` : ""} lines
          </span>
        }
      >
        <textarea
          id={id}
          name={name}
          rows={field.rows ?? Math.max(4, Math.min(lines + 1, 10))}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={described}
          className={inputArea}
        />
      </FieldShell>
    );
  }

  if (field.type === "textarea") {
    return (
      <FieldShell
        htmlFor={id}
        label={field.label}
        help={field.help}
        required={field.required}
        error={error}
        hint={<CharCount value={text} max={field.maxLength} />}
      >
        <textarea
          id={id}
          name={name}
          rows={field.rows ?? 4}
          maxLength={field.maxLength ?? undefined}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={described}
          className={inputArea}
        />
      </FieldShell>
    );
  }

  if (field.type === "select") {
    return (
      <FieldShell htmlFor={id} label={field.label} help={field.help} required={field.required} error={error}>
        <select
          id={id}
          name={name}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={described}
          className={selectPill}
        >
          {!field.required && <option value="">Not set</option>}
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </FieldShell>
    );
  }

  if (field.type === "number") {
    return (
      <FieldShell htmlFor={id} label={field.label} help={field.help} required={field.required} error={error}>
        <input
          id={id}
          name={name}
          type="number"
          inputMode="decimal"
          value={text}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={described}
          className={cn(inputPill, "max-w-[14rem]")}
        />
      </FieldShell>
    );
  }

  // text | url | link
  return (
    <FieldShell
      htmlFor={id}
      label={field.label}
      help={field.help ?? (isLinkField(field.type) ? LINK_HELP : null)}
      required={field.required}
      error={error}
      hint={<CharCount value={text} max={field.maxLength} />}
    >
      <input
        id={id}
        name={name}
        type="text"
        inputMode={isLinkField(field.type) ? "url" : "text"}
        maxLength={field.maxLength ?? undefined}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={described}
        className={inputPill}
      />
    </FieldShell>
  );
}

function CharCount({ value, max }: { value: string; max: number | null }) {
  if (!max) return null;
  const near = value.length > max * 0.85;
  return (
    <span className={cn("text-xs tabular-nums", near ? "text-champagne-600" : "text-ink-600")}>
      {value.length} / {max}
    </span>
  );
}

function ImageField({
  id,
  name,
  field,
  value,
  onChange,
  error,
}: {
  id: string;
  name: string;
  field: FieldDescriptor;
  value: string;
  onChange: (next: string) => void;
  error?: string | null;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const pick = (asset: MediaAsset) => {
    onChange(mediaUrl(asset));
    setPickerOpen(false);
  };

  return (
    <FieldShell
      htmlFor={id}
      label={field.label}
      help={field.help ?? "Pick from the media library, or paste an image address."}
      required={field.required}
      error={error}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-cream-300 bg-cream-100">
          {value ? (
            // Unoptimised: an admin-pasted address may sit outside the
            // next/image remotePatterns allowlist, and a thumbnail is not
            // worth a render-time throw.
            <Image src={value} alt="" fill sizes="96px" unoptimized className="object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center text-ink-400">
              <ImagePlus className="h-5 w-5" strokeWidth={1.5} aria-hidden />
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <input
            id={id}
            name={name}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="/editorial/hero-gentleman.webp"
            aria-describedby={error ? `${id}-error` : undefined}
            className={inputPill}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-full border border-cream-300 px-4 text-xs font-medium text-ink-800 transition-colors hover:border-wine-700 hover:text-wine-700",
                focusRing,
              )}
            >
              <ImagePlus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
              Choose from library
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-full px-4 text-xs text-ink-600 transition-colors hover:text-wine-700",
                  focusRing,
                )}
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <MediaPickerDialog open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={pick} />
    </FieldShell>
  );
}
