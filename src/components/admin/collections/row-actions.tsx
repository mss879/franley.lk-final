"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2, Pencil, Trash2 } from "lucide-react";
import {
  deleteCollection,
  moveCollection,
  setCollectionActive,
} from "@/app/admin/(guarded)/collections/actions";
import type { ActionResult } from "@/app/admin/(guarded)/collections/schema";
import { useCategoryFeedback } from "@/components/admin/categories/feedback";
import { cn } from "@/lib/utils";

const iconButton =
  "grid h-9 w-9 place-items-center rounded-full border border-cream-300 bg-white text-ink-600 " +
  "transition-colors duration-200 hover:border-wine-700 hover:text-wine-700 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 " +
  "ring-offset-cream-50 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-cream-300 disabled:hover:text-ink-600";

export function CollectionStatusToggle({
  id,
  name,
  isActive,
  hasLiveProducts,
}: {
  id: string;
  name: string;
  isActive: boolean;
  /** An empty collection stays off the storefront even when switched on. */
  hasLiveProducts: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const report = useCategoryFeedback();

  const toggle = () =>
    start(async () => {
      const result = await setCollectionActive(id, !isActive);
      report(
        result.ok
          ? {
              tone: "success",
              message: isActive
                ? `“${name}” is hidden. Its page and footer link have left the storefront.`
                : hasLiveProducts
                  ? `“${name}” is live on the storefront again.`
                  : `“${name}” is switched on. It will appear on the storefront once it holds an active product.`,
            }
          : { tone: "error", message: result.message },
      );
      if (result.ok) router.refresh();
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

export function CollectionRowActions({
  id,
  name,
  memberCount,
  canMoveUp,
  canMoveDown,
}: {
  id: string;
  name: string;
  memberCount: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const report = useCategoryFeedback();

  const run = (fn: () => Promise<ActionResult>, onSuccess?: string) =>
    start(async () => {
      const result = await fn();
      setConfirming(false);
      if (result.ok) {
        if (onSuccess) report({ tone: "success", message: onSuccess });
        router.refresh();
      } else {
        report({ tone: "error", message: result.message });
      }
    });

  if (confirming) {
    return (
      <div className="flex items-center justify-end gap-2">
        <span className="text-xs text-ink-600">
          Delete “{name}”
          {memberCount > 0 ? ` and drop its ${memberCount} member${memberCount === 1 ? "" : "s"}?` : "?"}
        </span>
        <button
          type="button"
          onClick={() =>
            run(
              () => deleteCollection(id),
              `“${name}” has been deleted. The products in it are untouched.`,
            )
          }
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
        onClick={() => run(() => moveCollection(id, "up"))}
        aria-label={`Move ${name} up`}
      >
        <ArrowUp className="h-4 w-4" strokeWidth={1.5} aria-hidden />
      </button>
      <button
        type="button"
        className={iconButton}
        disabled={!canMoveDown || pending}
        onClick={() => run(() => moveCollection(id, "down"))}
        aria-label={`Move ${name} down`}
      >
        <ArrowDown className="h-4 w-4" strokeWidth={1.5} aria-hidden />
      </button>

      <Link href={`/admin/collections/${id}/edit`} className={iconButton} aria-label={`Edit ${name}`}>
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
