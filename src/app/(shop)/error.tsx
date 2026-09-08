"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { WhatsAppIcon } from "@/components/ui/social-icons";
import { SITE } from "@/lib/constants";

export default function ShopError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Franley storefront error", error);
  }, [error]);

  const wa = `https://wa.me/${SITE.whatsapp.replace(/\D/g, "")}`;

  return (
    <section className="silk-texture -mt-20 grid min-h-dvh place-items-center bg-wine-700 px-5 pt-20 text-center text-cream-100">
      <div className="max-w-xl" role="alert">
        <Eyebrow tone="light">Something went wrong</Eyebrow>
        <h1 className="font-display mt-5 text-[clamp(2.5rem,7vw,4.5rem)] leading-[0.98] text-balance">
          This page did not load
        </h1>
        <p className="mt-5 text-sm leading-relaxed text-cream-100/70 text-pretty md:text-base">
          A moment&rsquo;s trouble on our side, not on yours. Try again — the
          collection is still there.
        </p>

        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Button variant="cream" size="lg" onClick={() => retry()}>
            Try again
          </Button>
          <ButtonLink href="/" variant="outlineLight" size="lg">
            Back to the shop
          </ButtonLink>
        </div>

        <p className="mt-9 text-sm text-cream-100/70">
          Still stuck? We will take the order by message.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
          <a
            href={wa}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 rounded-full text-champagne-300 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-on-wine focus-visible:ring-offset-wine-700"
          >
            <WhatsAppIcon className="h-4 w-4" />
            WhatsApp {SITE.phoneLocal}
          </a>
          <a
            href={`mailto:${SITE.email}`}
            className="rounded-full text-champagne-300 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-on-wine focus-visible:ring-offset-wine-700"
          >
            {SITE.email}
          </a>
        </div>

        {error.digest && (
          <p className="mt-8 text-[11px] tracking-[0.12em] text-cream-100/45">
            Reference {error.digest}
          </p>
        )}
      </div>
    </section>
  );
}
