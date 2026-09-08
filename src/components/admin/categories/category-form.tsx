"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";
import { AlertCircle, ChevronDown, Loader2 } from "lucide-react";
import {
  EMPTY_FORM_STATE,
  SLUG_PATTERN,
  type CategoryFormState,
} from "@/app/admin/(guarded)/categories/schema";
import { cn, slugify } from "@/lib/utils";
import { CategoryImageField } from "./image-field";

export type CategoryFormValues = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  parentId: string;
  position: number;
  isActive: boolean;
  imageUrl: string;
};

const inputClass =
  "h-11 w-full rounded-full border border-cream-300 bg-white px-5 text-sm text-ink-800 placeholder:text-ink-600 " +
  "focus-visible:border-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]";

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-cream-300 bg-white p-6 md:p-7">
      <h2 className="eyebrow text-wine-700">{title}</h2>
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

export function CategoryForm({
  action,
  initial,
  parents,
  parentLockReason,
  submitLabel,
}: {
  action: (state: CategoryFormState, formData: FormData) => Promise<CategoryFormState>;
  initial: CategoryFormValues;
  parents: { id: string; name: string }[];
  /** Set when this category has children of its own and so must stay top level. */
  parentLockReason?: string;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE);

  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  // Editing an existing category must never silently rewrite a slug that is
  // already indexed and linked to.
  const [slugPinned, setSlugPinned] = useState(Boolean(initial.slug));
  const [description, setDescription] = useState(initial.description);
  const [parentId, setParentId] = useState(initial.parentId);
  const [position, setPosition] = useState(String(initial.position));
  const [isActive, setIsActive] = useState(initial.isActive);
  const [imageUrl, setImageUrl] = useState(initial.imageUrl);

  const nameId = useId();
  const slugId = useId();
  const descriptionId = useId();
  const parentIdId = useId();
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
            Lowercase letters, numbers and single hyphens. Changing it breaks links people already
            have.
          </p>
          <FieldError id={`${slugId}-error`} message={errors.slug} />
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
            className="mt-2 w-full rounded-2xl border border-cream-300 bg-white px-5 py-3.5 text-sm leading-relaxed text-ink-800 placeholder:text-ink-600 focus-visible:border-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            placeholder="Woven in a fine twill, finished by hand."
          />
          <p id={`${descriptionId}-help`} className="mt-2 text-xs text-ink-600">
            One line, shown under the name on the homepage tile.{" "}
            <span aria-live="polite">{descriptionLeft} characters left.</span>
          </p>
          <FieldError id={`${descriptionId}-error`} message={errors.description} />
        </div>
      </Panel>

      <Panel title="Placement">
        <div>
          <label htmlFor={parentIdId} className="eyebrow block text-ink-600">
            Parent category
          </label>
          <div className="relative mt-2">
            <select
              id={parentIdId}
              name="parentId"
              value={parentLockReason ? "" : parentId}
              disabled={Boolean(parentLockReason)}
              onChange={(e) => setParentId(e.target.value)}
              aria-invalid={errors.parentId ? true : undefined}
              aria-describedby={`${parentIdId}-help${errors.parentId ? ` ${parentIdId}-error` : ""}`}
              className={cn(
                inputClass,
                "appearance-none pr-12 disabled:cursor-not-allowed disabled:bg-cream-100 disabled:text-ink-400",
              )}
            >
              <option value="">None — this is a top-level category</option>
              {parents.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {parent.name}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
              strokeWidth={1.5}
              aria-hidden
            />
          </div>
          <p id={`${parentIdId}-help`} className="mt-2 text-xs leading-relaxed text-ink-600">
            {parentLockReason ??
              "Only top-level categories can be chosen — the tree is two levels deep, and a category can never sit inside its own branch."}
          </p>
          <FieldError id={`${parentIdId}-error`} message={errors.parentId} />
        </div>

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
            Lowest first, within its own level. You can also nudge the order with the arrows on the
            Categories list.
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
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-cream-300 accent-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
            />
            <span>
              <span className="block text-sm font-medium text-ink-800">Show on the storefront</span>
              <span className="mt-1 block text-xs leading-relaxed text-ink-600">
                Hiding a category removes it from the homepage tiles and its /collections page — and
                the products filed directly under it stop appearing in the shop too.
              </span>
            </span>
          </label>
        </div>
      </Panel>

      <Panel title="Imagery">
        <CategoryImageField
          value={imageUrl}
          onChange={setImageUrl}
          serverError={errors.imageUrl}
        />
      </Panel>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-wine-700 px-7 text-sm font-medium text-cream-50 transition-colors duration-300 hover:bg-wine-600 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 ring-offset-cream-50"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link
          href="/admin/categories"
          className="inline-flex h-11 items-center justify-center rounded-full border border-ink-800/20 px-7 text-sm font-medium text-ink-800 transition-colors duration-300 hover:border-wine-700 hover:text-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 ring-offset-cream-50"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
