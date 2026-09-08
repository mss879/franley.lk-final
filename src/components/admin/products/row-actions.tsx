"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Copy, Loader2, Pencil } from "lucide-react";
import { duplicateProduct, setProductStatus } from "@/app/admin/(guarded)/products/actions";
import type { ProductStatus } from "./shared";

const iconButton =
  "inline-flex h-9 w-9 items-center justify-center rounded-full border border-cream-300 text-ink-600 " +
  "transition-colors duration-200 hover:border-wine-700 hover:text-wine-700 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 " +
  "disabled:pointer-events-none disabled:opacity-50";

export function ProductRowActions({
  id,
  title,
  status,
}: {
  id: string;
  title: string;
  status: ProductStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const archived = status === "archived";

  const run = (fn: () => Promise<{ ok: boolean; message?: string; id?: string }>, after?: (id?: string) => void) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.message ?? "Something went wrong.");
        return;
      }
      if (after) after(result.id);
      else router.refresh();
    });
  };

  return (
    <div className="flex items-center justify-end gap-1.5">
      <p role="status" aria-live="polite" className="sr-only">
        {pending ? `Working on ${title}` : error ? error : ""}
      </p>
      {error && (
        <span className="mr-1 max-w-40 truncate text-xs text-wine-700" title={error}>
          {error}
        </span>
      )}

      <Link href={`/admin/products/${id}/edit`} className={iconButton} title={`Edit ${title}`}>
        <Pencil className="h-4 w-4" strokeWidth={1.5} aria-hidden />
        <span className="sr-only">Edit {title}</span>
      </Link>

      <button
        type="button"
        disabled={pending}
        title={`Duplicate ${title}`}
        onClick={() =>
          run(
            () => duplicateProduct(id),
            (newId) => {
              if (newId) router.push(`/admin/products/${newId}/edit`);
              else router.refresh();
            },
          )
        }
        className={iconButton}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} aria-hidden />
        ) : (
          <Copy className="h-4 w-4" strokeWidth={1.5} aria-hidden />
        )}
        <span className="sr-only">Duplicate {title}</span>
      </button>

      <button
        type="button"
        disabled={pending}
        title={archived ? `Restore ${title} to draft` : `Archive ${title}`}
        onClick={() => run(() => setProductStatus(id, archived ? "draft" : "archived"))}
        className={iconButton}
      >
        {archived ? (
          <ArchiveRestore className="h-4 w-4" strokeWidth={1.5} aria-hidden />
        ) : (
          <Archive className="h-4 w-4" strokeWidth={1.5} aria-hidden />
        )}
        <span className="sr-only">{archived ? `Restore ${title} to draft` : `Archive ${title}`}</span>
      </button>
    </div>
  );
}
