"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function ProductGallery({ images, title }: { images: string[]; title: string }) {
  const [active, setActive] = useState(0);
  const shots = images.length ? images : [];

  return (
    <div className="flex flex-col-reverse gap-4 md:flex-row">
      {shots.length > 1 && (
        <ul className="no-scrollbar flex gap-3 overflow-x-auto md:flex-col md:overflow-visible" aria-label="Product images">
          {shots.map((src, i) => (
            <li key={src}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`View image ${i + 1} of ${shots.length}`}
                aria-current={i === active}
                className={cn(
                  "relative h-20 w-16 shrink-0 overflow-hidden rounded-lg border bg-white transition-colors duration-300",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2",
                  i === active ? "border-wine-700" : "border-cream-300 hover:border-ink-400",
                )}
              >
                <Image src={src} alt="" fill sizes="64px" className="object-contain p-1" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative aspect-[4/5] flex-1 overflow-hidden rounded-2xl border border-cream-300 bg-white">
        {shots[active] ? (
          <Image
            key={shots[active]}
            src={shots[active]}
            alt={active === 0 ? title : `${title} — view ${active + 1}`}
            fill
            preload
            sizes="(max-width: 1024px) 100vw, (max-width: 1400px) 45vw, 600px"
            className="animate-fade-up object-contain p-6"
          />
        ) : (
          <div className="grid h-full place-items-center text-sm text-ink-600">No image</div>
        )}
      </div>
    </div>
  );
}
