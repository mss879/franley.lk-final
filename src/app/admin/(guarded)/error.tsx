"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Deliberately says nothing about the error itself — admin pages read straight
 * from Supabase and a thrown PostgREST error carries table and column names.
 * The detail goes to the console, where only the operator sees it.
 */
export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Franley admin error", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-8 md:px-8 md:py-10">
      <div
        role="alert"
        className="rounded-3xl border border-cream-300 bg-white px-6 py-14 text-center"
      >
        <p className="eyebrow text-ink-600">Admin</p>
        <h1 className="font-display mt-4 text-2xl text-ink-900">
          This screen could not be loaded
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-600">
          The details are in the browser console. Try again, and if it keeps
          failing check that the database is reachable.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button size="md" onClick={() => retry()}>
            Try again
          </Button>
          <Link
            href="/admin"
            className="inline-flex h-11 items-center justify-center rounded-full border border-ink-800/20 px-6 text-sm font-medium text-ink-800 transition-colors duration-300 hover:border-wine-700 hover:text-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
