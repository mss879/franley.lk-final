"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  EMPTY_FORM_STATE,
  SLUG_PATTERN,
  type CollectionFormState,
} from "@/app/admin/(guarded)/collections/schema";
import { AssetImageField } from "@/components/admin/shared/image-field";
import { cn, slugify } from "@/lib/utils";

export type CollectionFormValues = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  heroEyebrow: string;
  position: number;
  isActive: boolean;
  imageUrl: string;
};

const inputClass =
  "h-11 w-full rounded-full border border-cream-300 bg-white px-5 text-sm text-ink-800 placeholder:text-ink-600 " +
  "focus-visible:border-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-cream-300 bg-white p-6 md:p-7">
      <h2 className="eyebrow text-champagne-700">{title}</h2>
      <div className="mt-5 space-y-6">{children}</div>
    </section>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-2 text-xs leading-relaxed text-wine-700">
      {message}
    </p>
  );
}

export function CollectionForm({
  action,
  initial,
  submitLabel,
}: {
  action: (state: CollectionFormState, formData: FormData) => Promise<CollectionFormState>;
  initial: CollectionFormValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE);

  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  // Editing an existing collection must never silently rewrite a slug that is
  // already indexed and linked to.
  const [slugPinned, setSlugPinned] = useState(Boolean(initial.slug));
  const [description, setDescription] = useState(initial.description);
  const [heroEyebrow, setHeroEyebrow] = useState(initial.heroEyebrow);
  const [position, setPosition] = useState(String(initial.position));
  const [isActive, setIsActive] = useState(initial.isActive);
  const [imageUrl, setImageUrl] = useState(initial.imageUrl);

  const nameId = useId();
  const slugId = useId();
  const descriptionId = useId();
  const eyebrowId = useId();
  const positionId = useId();
  const isActiveId = useId();

  const errors = state.fieldErrors ?? {};
  const descriptionLeft = 500 - description.length;

  return (
    <form action={formAction} className="space-y-6">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}

      {state.status === "error" && state.message && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-wine-700/25 bg-wine-700/6 px-5 py-4"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-wine-700" strokeWidth={1.5} aria-hidden />
          <p className="text-sm leading-relaxed text-ink-800">{state.message}</p>
        </div>
      )}

      <Panel title="Details">
        <div>
          <label htmlFor={nameId} className="eyebrow block text-ink-600">
            Name
          </label>
          <input
            id={nameId}
            name="name"
            type="text"
            required
            maxLength={80}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugPinned) setSlug(slugify(e.target.value));
            }}
            autoComplete="off"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? `${nameId}-error` : undefined}
            className={cn("mt-2", inputClass)}
          />
          <FieldError id={`${nameId}-error`} message={errors.name} />
        </div>

        <div>
          <label htmlFor={slugId} className="eyebrow block text-ink-600">
            Slug
          </label>
          <input
            id={slugId}
            name="slug"
            type="text"
            required
            minLength={2}
            maxLength={64}
            pattern={SLUG_PATTERN}
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugPinned(true);
            }}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={errors.slug ? true : undefined}
            aria-describedby={`${slugId}-help${errors.slug ? ` ${slugId}-error` : ""}`}
            className={cn("mt-2", inputClass)}
          />
          <p id={`${slugId}-help`} className="mt-2 text-xs leading-relaxed text-ink-600">
            The collection address: <span className="text-ink-800">/collections/{slug || "…"}</span>.
            Lowercase letters, numbers and single hyphens. Categories live at the same address,
            so a slug a category already uses is refused. Changing it breaks links people already
            have.
          </p>
          <FieldError id={`${slugId}-error`} message={errors.slug} />
        </div>

        <div>
          <label htmlFor={eyebrowId} className="eyebrow block text-ink-600">
            Eyebrow
          </label>
          <input
            id={eyebrowId}
            name="heroEyebrow"
            type="text"
            maxLength={60}
            value={heroEyebrow}
            onChange={(e) => setHeroEyebrow(e.target.value)}
            autoComplete="off"
            placeholder="Gifting"
            aria-invalid={errors.heroEyebrow ? true : undefined}
            aria-describedby={`${eyebrowId}-help${errors.heroEyebrow ? ` ${eyebrowId}-error` : ""}`}
            className={cn("mt-2 sm:max-w-sm", inputClass)}
          />
          <p id={`${eyebrowId}-help`} className="mt-2 text-xs leading-relaxed text-ink-600">
            The small label above the name on its page. Leave it empty for “Collection”.
          </p>
          <FieldError id={`${eyebrowId}-error`} message={errors.heroEyebrow} />
        </div>

        <div>
          <label htmlFor={descriptionId} className="eyebrow block text-ink-600">
            Description
          </label>
          <textarea
            id={descriptionId}
            name="description"
            rows={3}
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-invalid={errors.description ? true : undefined}
            aria-describedby={`${descriptionId}-help${errors.description ? ` ${descriptionId}-error` : ""}`}
            className="mt-2 w-full rounded-2xl border border-cream-300 bg-white px-5 py-3.5 text-sm leading-relaxed text-ink-800 placeholder:text-ink-600 focus-visible:border-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            placeholder="Pieces that arrive ready to hand over."
          />
          <p id={`${descriptionId}-help`} className="mt-2 text-xs text-ink-600">
            A line or two under the name on its page, and the search snippet.{" "}
            <span aria-live="polite">{descriptionLeft} characters left.</span>
          </p>
          <FieldError id={`${descriptionId}-error`} message={errors.description} />
        </div>
      </Panel>

      <Panel title="Placement">
        <div>
          <label htmlFor={positionId} className="eyebrow block text-ink-600">
            Position
          </label>
          <input
            id={positionId}
            name="position"
            type="number"
            min={0}
            max={9999}
            step={1}
            required
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            aria-invalid={errors.position ? true : undefined}
            aria-describedby={`${positionId}-help${errors.position ? ` ${positionId}-error` : ""}`}
            className={cn("mt-2 sm:max-w-40", inputClass)}
          />
          <p id={`${positionId}-help`} className="mt-2 text-xs leading-relaxed text-ink-600">
            Lowest first, on the /collections page and in the footer. You can also nudge the order
            with the arrows on the Collections list.
          </p>
          <FieldError id={`${positionId}-error`} message={errors.position} />
        </div>

        <div className="rounded-2xl border border-cream-300 bg-cream-50 p-4">
          <label htmlFor={isActiveId} className="flex cursor-pointer items-start gap-3">
            <input
              id={isActiveId}
              type="checkbox"
              name="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-cream-300 accent-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
            />
            <span>
              <span className="block text-sm font-medium text-ink-800">Show on the storefront</span>
              <span className="mt-1 block text-xs leading-relaxed text-ink-600">
                Hiding a collection removes its page and its footer link. The products in it stay
                on sale everywhere else.
              </span>
            </span>
          </label>
        </div>
      </Panel>

      <Panel title="Imagery">
        <AssetImageField
          value={imageUrl}
          onChange={setImageUrl}
          serverError={errors.imageUrl}
          label="Hero image"
          help="A wide editorial photograph shown under the heading on the collection page and on its card on /collections. Leave it empty and the page opens straight onto the products."
          folder="banners"
          placeholder="/editorial/desk-ties.webp"
        />
      </Panel>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-ink-900 px-7 text-sm font-medium text-cream-50 transition-colors duration-300 hover:bg-wine-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 ring-offset-cream-50"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link
          href="/admin/collections"
          className="inline-flex h-11 items-center justify-center rounded-full border border-ink-800/20 px-7 text-sm font-medium text-ink-800 transition-colors duration-300 hover:border-wine-700 hover:text-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 ring-offset-cream-50"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
