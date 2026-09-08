"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { AlertCircle, Check, X } from "lucide-react";

/**
 * Row buttons live inside a horizontally scrolling table, so their messages —
 * "you must move these four products first" — are reported up here instead of
 * into a cell that would clip them.
 */

type Feedback = { tone: "error" | "success"; message: string } | null;

const ReportContext = createContext<(feedback: Feedback) => void>(() => {});

export function useCategoryFeedback() {
  return useContext(ReportContext);
}

export function CategoryFeedback({ children }: { children: React.ReactNode }) {
  const [feedback, setFeedback] = useState<Feedback>(null);
  const report = useCallback((next: Feedback) => setFeedback(next), []);

  return (
    <ReportContext.Provider value={report}>
      <div aria-live="polite">
        {feedback && (
          <div
            role={feedback.tone === "error" ? "alert" : "status"}
            className={
              feedback.tone === "error"
                ? "mb-5 flex items-start gap-3 rounded-2xl border border-wine-700/25 bg-wine-700/6 px-5 py-4"
                : "mb-5 flex items-start gap-3 rounded-2xl border border-cream-300 bg-cream-100 px-5 py-4"
            }
          >
            {feedback.tone === "error" ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-wine-700" strokeWidth={1.5} aria-hidden />
            ) : (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-wine-700" strokeWidth={1.5} aria-hidden />
            )}
            <p className="flex-1 text-sm leading-relaxed text-ink-800">{feedback.message}</p>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              aria-label="Dismiss message"
              className="-mr-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-400 transition-colors hover:text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        )}
      </div>
      {children}
    </ReportContext.Provider>
  );
}
