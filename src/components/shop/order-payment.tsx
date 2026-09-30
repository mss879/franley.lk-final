"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { redirectToPayHere } from "@/lib/payhere/redirect";

/** How long to keep asking the server whether PayHere's notification has landed. */
const POLL_MS = 4000;
const MAX_POLLS = 8;

/**
 * The payment panel on the order page for a card order that is not paid yet.
 *
 * `returning` means the shopper has just come back from PayHere. Their payment
 * may well have succeeded — PayHere's notification to the server usually lands
 * within a second or two of the redirect, but not always before it — so the
 * page re-checks for a little while before offering to take payment again.
 */
export function OrderPayment({
  orderNumber,
  token,
  returning,
  failed,
  processing = false,
}: {
  orderNumber: string;
  token: string;
  returning: boolean;
  failed: boolean;
  /** PayHere reported the payment as pending: an attempt is still in flight. */
  processing?: boolean;
}) {
  const router = useRouter();
  const [polls, setPolls] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const waiting = returning && polls < MAX_POLLS;

  useEffect(() => {
    if (!waiting) return;
    const t = setTimeout(() => {
      setPolls((n) => n + 1);
      router.refresh();
    }, POLL_MS);
    return () => clearTimeout(t);
  }, [waiting, polls, router]);

  async function payNow() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/payhere/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, token }),
      });
      const json = await res.json();
      if (!res.ok || !json.payhere) {
        setError(json.error ?? "We could not start the payment. Please try again.");
        setBusy(false);
        return;
      }
      redirectToPayHere(json.payhere);
    } catch {
      setError("Network problem — check your connection and try again.");
      setBusy(false);
    }
  }

  if (processing && !waiting) {
    return (
      <div role="status" className="mt-5 rounded-2xl bg-cream-200 px-4 py-3 text-xs leading-relaxed text-ink-600">
        PayHere is still processing your payment. This page updates once it is confirmed — please do not
        pay again. If it has not cleared within the hour, message us with your order number.
      </div>
    );
  }

  if (waiting) {
    return (
      <div role="status" className="mt-5 flex items-start gap-3 rounded-2xl bg-cream-200 px-4 py-3 text-xs leading-relaxed text-ink-600">
        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-ink-600" aria-hidden />
        <span>Confirming your payment with PayHere. This usually takes a few seconds — you do not need to do anything.</span>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-2xl border border-champagne-300 bg-champagne-100/60 px-4 py-4">
      <p className="text-sm font-medium text-ink-900">
        {returning ? "We have not received your payment yet" : failed ? "Your payment did not go through" : "This order is not paid yet"}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-600">
        {returning
          ? "If money has left your account, do not pay again — message us and we will check. Otherwise you can try the payment once more."
          : "Your pieces are held for you. Pay securely through PayHere to confirm the order."}
      </p>

      {error && <p role="alert" className="mt-3 text-xs text-wine-800">{error}</p>}

      <button
        type="button"
        onClick={payNow}
        disabled={busy}
        className="mt-4 grid h-12 w-full place-items-center rounded-full bg-ink-900 text-sm font-medium text-cream-50 transition-colors hover:bg-wine-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
      >
        {busy ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Taking you to PayHere…
          </span>
        ) : (
          "Pay now"
        )}
      </button>
    </div>
  );
}
