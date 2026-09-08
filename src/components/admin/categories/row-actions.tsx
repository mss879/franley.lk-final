"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2, Pencil, Trash2 } from "lucide-react";
import {
  deleteCategory,
  moveCategory,
  setCategoryActive,
} from "@/app/admin/(guarded)/categories/actions";
import type { ActionResult } from "@/app/admin/(guarded)/categories/schema";
import { cn } from "@/lib/utils";
import { useCategoryFeedback } from "./feedback";

const iconButton =
  "grid h-9 w-9 place-items-center rounded-full border border-cream-300 bg-white text-ink-600 " +
  "transition-colors duration-200 hover:border-wine-700 hover:text-wine-700 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 " +
  "ring-offset-cream-50 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-cream-300 disabled:hover:text-ink-600";

export function CategoryStatusToggle({
  id,
  name,
  isActive,
}: {
  id: string;
  name: string;
  isActive: boolean;
}) {
  const [pending, start] = useTransition();
  const report = useCategoryFeedback();

  const toggle = () =>
    start(async () => {
      const result = await setCategoryActive(id, !isActive);
      report(
        result.ok
          ? {
              tone: "success",
              message: isActive
                ? `“${name}” is hidden. It and the products filed directly under it have left the storefront.`
                : `“${name}” is live on the storefront again.`,
            }
          : { tone: "error", message: result.message },
      );
    });

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-label={isActive ? `Hide ${name} from the storefront` : `Show ${name} on the storefront`}
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 ring-offset-cream-50",
        "disabled:opacity-60",
        isActive
          ? "border-wine-700/25 bg-wine-700/8 text-wine-800 hover:bg-wine-700/14"
          : "border-cream-300 bg-cream-100 text-ink-400 hover:text-ink-600",
      )}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : isActive ? (
        <Eye className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
      ) : (
        <EyeOff className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
      )}
      {isActive ? "Live" : "Hidden"}
    </button>
  );
}

export function CategoryRowActions({
  id,
  name,
  canMoveUp,
  canMoveDown,
}: {
  id: string;
  name: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const report = useCategoryFeedback();

  const run = (fn: () => Promise<ActionResult>, onSuccess?: string) =>
    start(async () => {
      const result = await fn();
      if (result.ok) {
        setConfirming(false);
        if (onSuccess) report({ tone: "success", message: onSuccess });
      } else {
        setConfirming(false);
        report({ tone: "error", message: result.message });
      }
    });

  if (confirming) {
    return (
      <div className="flex items-center justify-end gap-2">
        <span className="text-xs text-ink-600">Delete “{name}”?</span>
        <button
          type="button"
          onClick={() => run(() => deleteCategory(id), `“${name}” has been deleted.`)}
          disabled={pending}
          className="h-8 rounded-full bg-wine-700 px-4 text-xs font-medium text-cream-50 transition-colors hover:bg-wine-600 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 ring-offset-cream-50"
        >
          {pending ? "Deleting…" : "Delete"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="h-8 rounded-full border border-cream-300 px-4 text-xs font-medium text-ink-600 transition-colors hover:border-ink-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 ring-offset-cream-50"
        >
          Keep
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <button
        type="button"
        className={iconButton}
        disabled={!canMoveUp || pending}
        onClick={() => run(() => moveCategory(id, "up"))}
        aria-label={`Move ${name} up`}
      >
        <ArrowUp className="h-4 w-4" strokeWidth={1.5} aria-hidden />
      </button>
      <button
        type="button"
        className={iconButton}
        disabled={!canMoveDown || pending}
        onClick={() => run(() => moveCategory(id, "down"))}
        aria-label={`Move ${name} down`}
      >
        <ArrowDown className="h-4 w-4" strokeWidth={1.5} aria-hidden />
      </button>

      <Link href={`/admin/categories/${id}/edit`} className={iconButton} aria-label={`Edit ${name}`}>
        <Pencil className="h-4 w-4" strokeWidth={1.5} aria-hidden />
      </Link>

      <button
        type="button"
        className={cn(iconButton, "hover:bg-wine-700/8")}
        disabled={pending}
        onClick={() => setConfirming(true)}
        aria-label={`Delete ${name}`}
      >
        <Trash2 className="h-4 w-4" strokeWidth={1.5} aria-hidden />
      </button>
    </div>
  );
}
