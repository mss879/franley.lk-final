"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  addProductColour,
  deleteProductColour,
  updateProductColour,
} from "@/app/admin/(guarded)/products/actions";
import { cn } from "@/lib/utils";
import { inputClass } from "./fields";
import { ProductImages, type ProductImageRow } from "./product-images";

export type ProductColourRow = {
  id: string;
  name: string;
  stock: number;
};

/**
 * Colour options of one product. Each colour has its own stock and its own
 * photographs; the product's general photographs (the whole range together)
 * are managed above, and are what the product page opens on.
 */
export function ProductColours({
  productId,
  productTitle,
  colours,
  images,
}: {
  productId: string;
  productTitle: string;
  colours: ProductColourRow[];
  /** Every colour photograph of the product, each tagged with its colour. */
  images: (ProductImageRow & { color_id: string | null })[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [stock, setStock] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await addProductColour({ productId, name, stock });
      if (!result.ok) {
        setError(result.message ?? "Could not add the colour.");
        return;
      }
      setName("");
      setStock("0");
      router.refresh();
    });
  }

  return (
    <section className="space-y-5 rounded-3xl border border-cream-300 bg-white p-6 md:p-7">
      <div>
        <h2 className="font-display text-lg text-ink-900">Colours</h2>
        <p className="mt-1 text-xs text-ink-600">
          For a tie sold in several colours. Each colour has its own stock and photographs; shoppers pick a
          colour on the product page and see its photographs. With colours added, the product&apos;s stock is
          the total of its colours.
        </p>
      </div>

      <form onSubmit={add} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="new-colour-name" className="block text-xs font-medium text-ink-600">
            Colour name
          </label>
          <input
            id="new-colour-name"
            value={name}
            maxLength={60}
            required
            placeholder="Navy"
            onChange={(e) => setName(e.target.value)}
            className={cn(inputClass, "mt-1.5")}
          />
        </div>
        <div className="sm:w-32">
          <label htmlFor="new-colour-stock" className="block text-xs font-medium text-ink-600">
            Stock
          </label>
          <input
            id="new-colour-stock"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            className={cn(inputClass, "mt-1.5")}
          />
        </div>
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-ink-900 px-6 text-sm font-medium text-cream-50 transition-colors hover:bg-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
          Add colour
        </button>
      </form>

      {error && (
        <p role="alert" className="rounded-2xl border border-wine-700/25 bg-wine-50 px-4 py-3 text-sm text-wine-700">
          {error}
        </p>
      )}

      {colours.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-cream-300 px-6 py-8 text-center text-sm text-ink-600">
          No colours. The product is sold as it is, with the stock above.
        </p>
      ) : (
        <ul className="space-y-5">
          {colours.map((colour) => (
            <li key={colour.id} className="space-y-4 rounded-2xl border border-cream-300 p-4">
              <ColourEditor colour={colour} onDone={() => router.refresh()} />
              <ProductImages
                productId={productId}
                productTitle={`${productTitle} — ${colour.name}`}
                colorId={colour.id}
                images={images.filter((img) => img.color_id === colour.id)}
                heading={`${colour.name} photographs`}
                description={`Shown when a shopper picks ${colour.name}.`}
                emptyHint={`Add the ${colour.name} photographs. Until then the product's general photographs are shown for it.`}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ColourEditor({ colour, onDone }: { colour: ProductColourRow; onDone: () => void }) {
  const [name, setName] = useState(colour.name);
  const [stock, setStock] = useState(String(colour.stock));
  const [status, setStatus] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const dirty = name.trim() !== colour.name || stock !== String(colour.stock);

  const save = () =>
    startTransition(async () => {
      const result = await updateProductColour(colour.id, { name, stock });
      setStatus(result.ok ? "Saved." : (result.message ?? "Could not save."));
      if (result.ok) onDone();
    });

  const remove = () =>
    startTransition(async () => {
      const result = await deleteProductColour(colour.id);
      if (!result.ok) setStatus(result.message ?? "Could not delete.");
      else onDone();
    });

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1">
        <label htmlFor={`colour-name-${colour.id}`} className="block text-xs font-medium text-ink-600">
          Colour name
        </label>
        <input
          id={`colour-name-${colour.id}`}
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          className={cn(inputClass, "mt-1.5")}
        />
      </div>
      <div className="sm:w-32">
        <label htmlFor={`colour-stock-${colour.id}`} className="block text-xs font-medium text-ink-600">
          Stock
        </label>
        <input
          id={`colour-stock-${colour.id}`}
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          className={cn(inputClass, "mt-1.5")}
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty || !name.trim()}
          className="inline-flex h-11 items-center rounded-full border border-ink-900 px-5 text-sm font-medium text-ink-900 transition-colors hover:bg-ink-900 hover:text-cream-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 disabled:opacity-40"
        >
          Save
        </button>
        {confirming ? (
          <>
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="inline-flex h-11 items-center rounded-full bg-wine-700 px-4 text-xs font-medium text-cream-50 transition-colors hover:bg-wine-800 disabled:opacity-50"
            >
              Delete {colour.name}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-xs text-ink-600 underline underline-offset-4 hover:text-wine-700"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            title={`Delete ${colour.name}`}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-cream-300 text-ink-600 transition-colors hover:border-wine-700 hover:text-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            <span className="sr-only">Delete {colour.name}</span>
          </button>
        )}
      </div>
      {status && (
        <p aria-live="polite" className="text-xs text-ink-600 sm:pb-3">
          {status}
        </p>
      )}
    </div>
  );
}
