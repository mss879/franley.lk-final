"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ImageOff, Loader2, PackageOpen, Plus, Search, X } from "lucide-react";
import {
  addProductsToCollection,
  moveCollectionProduct,
  removeProductFromCollection,
} from "@/app/admin/(guarded)/collections/actions";
import type {
  CollectionMember,
  PickerProduct,
  ProductStatus,
} from "@/app/admin/(guarded)/collections/data";
import type { ActionResult } from "@/app/admin/(guarded)/collections/schema";
import { resolveImageSrc } from "@/components/admin/products/shared";
import { cn, formatPrice } from "@/lib/utils";

const STATUS_STYLE: Record<ProductStatus, string> = {
  active: "border-wine-700/25 bg-wine-700/8 text-wine-800",
  draft: "border-cream-300 bg-cream-100 text-ink-600",
  archived: "border-cream-300 bg-cream-100 text-ink-400",
};

const iconButton =
  "grid h-9 w-9 place-items-center rounded-full border border-cream-300 bg-white text-ink-600 " +
  "transition-colors duration-200 hover:border-wine-700 hover:text-wine-700 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 " +
  "ring-offset-cream-50 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-cream-300 disabled:hover:text-ink-600";

function StatusPill({ status }: { status: ProductStatus }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-medium capitalize",
        STATUS_STYLE[status],
      )}
    >
      {status}
    </span>
  );
}

function Thumbnail({ url, size = "h-11 w-11" }: { url: string | null; size?: string }) {
  if (!url) {
    return (
      <span
        aria-hidden
        className={cn(
          "grid shrink-0 place-items-center rounded-xl border border-cream-300 bg-cream-100 text-ink-400",
          size,
        )}
      >
        <ImageOff className="h-4 w-4" strokeWidth={1.5} />
      </span>
    );
  }
  return (
    // Product shots are cut-outs on white, so the frame stays white with the
    // image contained. A key or any https host is fine for a plain img.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolveImageSrc(url)}
      alt=""
      width={44}
      height={44}
      className={cn("shrink-0 rounded-xl border border-cream-300 bg-white object-contain p-1", size)}
    />
  );
}

type Message = { tone: "ok" | "error"; text: string } | null;

export function CollectionProducts({
  collectionId,
  collectionName,
  members,
  picker,
}: {
  collectionId: string;
  collectionName: string;
  members: CollectionMember[];
  picker: PickerProduct[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<Message>(null);

  const run = (productId: string, fn: () => Promise<ActionResult>, onSuccess?: string) => {
    setBusyId(productId);
    start(async () => {
      const result = await fn();
      setBusyId(null);
      setMessage(
        result.ok
          ? onSuccess
            ? { tone: "ok", text: onSuccess }
            : null
          : { tone: "error", text: result.message },
      );
      if (result.ok) router.refresh();
    });
  };

  const hiddenMembers = members.filter((m) => m.status !== "active").length;

  return (
    <div className="space-y-8">
      <div>
        <p aria-live="polite" className="mb-3 min-h-4 text-xs leading-relaxed">
          {message && (
            <span className={message.tone === "error" ? "text-wine-700" : "text-ink-600"}>
              {message.text}
            </span>
          )}
        </p>

        {members.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-cream-300 bg-cream-50 px-6 py-10 text-center">
            <PackageOpen className="mx-auto h-6 w-6 text-ink-400" strokeWidth={1.5} aria-hidden />
            <p className="mt-3 text-sm text-ink-800">Nothing is in {collectionName} yet.</p>
            <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-ink-600">
              Pick products below and they will appear here in the order you add them. The page
              stays hidden from shoppers until it has something to show.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-cream-300 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] border-collapse text-left">
                <caption className="sr-only">
                  Products in {collectionName}, in the order shoppers see them
                </caption>
                <thead>
                  <tr className="border-b border-cream-300 bg-cream-100/70">
                    <th scope="col" className="eyebrow px-6 py-4 text-ink-600">
                      Product
                    </th>
                    <th scope="col" className="eyebrow px-6 py-4 text-ink-600">
                      Price
                    </th>
                    <th scope="col" className="px-6 py-4 text-right">
                      <span className="eyebrow text-ink-600">Order</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((product, i) => {
                    const busy = pending && busyId === product.id;
                    return (
                      <tr key={product.id} className="border-b border-cream-300/70 last:border-b-0">
                        <th scope="row" className="px-6 py-4 font-normal">
                          <div className="flex items-center gap-3">
                            <span className="w-6 shrink-0 text-xs tabular-nums text-ink-400">
                              {i + 1}
                            </span>
                            <Thumbnail url={product.image} />
                            <div className="min-w-0">
                              <Link
                                href={`/admin/products/${product.id}/edit`}
                                className="text-sm text-ink-800 transition-colors hover:text-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 rounded-sm"
                              >
                                {product.title}
                              </Link>
                              <p className="mt-1 flex items-center gap-2 text-xs text-ink-600">
                                <StatusPill status={product.status} />
                                {product.stock} in stock
                              </p>
                            </div>
                          </div>
                        </th>
                        <td className="whitespace-nowrap px-6 py-4 align-middle text-sm text-ink-800">
                          {formatPrice(product.priceCents)}
                        </td>
                        <td className="px-6 py-4 align-middle">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              className={iconButton}
                              disabled={i === 0 || pending}
                              onClick={() =>
                                run(product.id, () =>
                                  moveCollectionProduct(collectionId, product.id, "up"),
                                )
                              }
                              aria-label={`Move ${product.title} up`}
                            >
                              <ArrowUp className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                            </button>
                            <button
                              type="button"
                              className={iconButton}
                              disabled={i === members.length - 1 || pending}
                              onClick={() =>
                                run(product.id, () =>
                                  moveCollectionProduct(collectionId, product.id, "down"),
                                )
                              }
                              aria-label={`Move ${product.title} down`}
                            >
                              <ArrowDown className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                            </button>
                            <button
                              type="button"
                              className={cn(iconButton, "hover:bg-wine-700/8")}
                              disabled={pending}
                              onClick={() =>
                                run(
                                  product.id,
                                  () => removeProductFromCollection(collectionId, product.id),
                                  `“${product.title}” has been taken out of ${collectionName}.`,
                                )
                              }
                              aria-label={`Remove ${product.title} from ${collectionName}`}
                            >
                              {busy ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                              ) : (
                                <X className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {hiddenMembers > 0 && (
          <p className="mt-3 text-xs leading-relaxed text-ink-600">
            {hiddenMembers === members.length
              ? "None of these are active yet, so the collection page stays hidden from shoppers until one is."
              : `${hiddenMembers} of these ${hiddenMembers === 1 ? "is a draft or archived piece" : "are draft or archived pieces"}. ` +
                "They keep their place here but do not show on the storefront until they are active."}
          </p>
        )}
      </div>

      <AddProducts
        collectionId={collectionId}
        collectionName={collectionName}
        picker={picker}
        memberIds={members.map((m) => m.id)}
        onDone={(text) => setMessage({ tone: "ok", text })}
      />
    </div>
  );
}

/**
 * The whole catalogue with a search box and checkboxes. Roughly fifty rows,
 * so it is filtered here rather than round-tripping to the server.
 */
function AddProducts({
  collectionId,
  collectionName,
  picker,
  memberIds,
  onDone,
}: {
  collectionId: string;
  collectionName: string;
  picker: PickerProduct[];
  memberIds: string[];
  onDone: (message: string) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const searchId = useId();
  const listId = useId();

  const available = useMemo(() => {
    const taken = new Set(memberIds);
    const needle = query.trim().toLowerCase();
    return picker.filter(
      (p) =>
        !taken.has(p.id) &&
        (!needle || p.title.toLowerCase().includes(needle) || p.slug.includes(needle)),
    );
  }, [picker, memberIds, query]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const ids = [...selected];
    if (ids.length === 0) {
      setError("Tick at least one product to add.");
      return;
    }
    start(async () => {
      const result = await addProductsToCollection(collectionId, ids);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSelected(new Set());
      setQuery("");
      onDone(
        result.added === 0
          ? "Those products were already in the collection."
          : `${result.added} product${result.added === 1 ? "" : "s"} added to ${collectionName}` +
              (result.skipped > 0 ? `; ${result.skipped} already there.` : "."),
      );
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="rounded-3xl border border-cream-300 bg-white p-6 md:p-7">
      <h3 className="eyebrow text-champagne-700">Add products</h3>
      <p className="mt-2 max-w-2xl text-xs leading-relaxed text-ink-600">
        Tick what belongs here and add it in one go. New pieces land at the end of the list; nudge
        them up with the arrows afterwards.
      </p>

      <div className="relative mt-5">
        <label htmlFor={searchId} className="sr-only">
          Search products by name
        </label>
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
          strokeWidth={1.5}
          aria-hidden
        />
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or slug"
          autoComplete="off"
          aria-controls={listId}
          className="h-11 w-full rounded-full border border-cream-300 bg-white pl-11 pr-5 text-sm text-ink-800 placeholder:text-ink-600 focus-visible:border-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        />
      </div>

      <p aria-live="polite" className="mt-3 text-xs text-ink-600">
        {available.length === 0
          ? picker.length === memberIds.length
            ? "Every product in the catalogue is already in this collection."
            : "No products match that search."
          : `${available.length} available · ${selected.size} selected`}
      </p>

      <ul
        id={listId}
        className="mt-3 max-h-96 divide-y divide-cream-300/70 overflow-y-auto rounded-2xl border border-cream-300"
      >
        {available.map((product) => {
          const checked = selected.has(product.id);
          return (
            <li key={product.id}>
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-cream-50",
                  checked && "bg-wine-700/4",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(product.id)}
                  className="h-4 w-4 shrink-0 rounded border-cream-300 accent-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
                />
                <Thumbnail url={product.image} size="h-9 w-9" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink-800">{product.title}</span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs text-ink-600">
                    <StatusPill status={product.status} />
                    <span className="truncate">/{product.slug}</span>
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || selected.size === 0}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-ink-900 px-7 text-sm font-medium text-cream-50 transition-colors duration-300 hover:bg-wine-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 ring-offset-cream-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden />
          )}
          {pending
            ? "Adding…"
            : selected.size > 0
              ? `Add ${selected.size} selected`
              : "Add selected"}
        </button>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-xs text-ink-600 underline underline-offset-4 transition-colors hover:text-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 rounded-sm"
          >
            Clear selection
          </button>
        )}
        <span aria-live="polite" className="text-xs text-wine-700">
          {error}
        </span>
      </div>
    </form>
  );
}
