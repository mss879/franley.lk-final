"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * An ambient, silent, looping clip inside a rounded frame.
 *
 * Never autoplays for someone who has asked the system to reduce motion — they
 * get the poster still instead. It also holds until the frame is actually on
 * screen, so a clip three sections down never competes with the hero for
 * bandwidth on a phone.
 */
export function VideoFrame({
  src,
  poster,
  alt,
  className,
}: {
  src: string;
  poster: string;
  alt: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [play, setPlay] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPlay(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn("relative overflow-hidden bg-wine-950", className)}>
      {play ? (
        <video
          src={src}
          poster={poster}
          autoPlay
          loop
          muted
          playsInline
          preload="none"
          aria-label={alt}
          className="h-full w-full object-cover"
        />
      ) : (
        <Image src={poster} alt={alt} fill sizes="(max-width: 1024px) 100vw, 620px" className="object-cover" />
      )}
    </div>
  );
}
