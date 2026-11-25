"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { sendAdminCode, signOutAdmin, verifyAdminCode } from "./actions";
import { safeAdminNext } from "./next-path";

const RESEND_SECONDS = 60;

export function VerifyForm({
  nextPath,
  autoSend,
  initialError,
}: {
  nextPath?: string;
  /** No live code for this session yet: send one as the page opens. */
  autoSend: boolean;
  initialError?: string;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(autoSend ? 0 : RESEND_SECONDS);
  const [verifying, startVerify] = useTransition();
  const [sending, startSend] = useTransition();
  const [signingOut, startSignOut] = useTransition();
  const autoSent = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = () => {
    startSend(async () => {
      setError(null);
      setNotice(null);
      const res = await sendAdminCode();
      if (res.done) {
        window.location.assign(safeAdminNext(nextPath));
        return;
      }
      if (res.ok) {
        setNotice(res.message);
        setCooldown(RESEND_SECONDS);
        inputRef.current?.focus();
      } else {
        setError(res.message);
      }
    });
  };

  // Once per page view. The ref keeps React's dev double-mount from sending
  // twice (the server would refuse the second one anyway: one per 60 s).
  useEffect(() => {
    if (!autoSend || initialError || autoSent.current) return;
    autoSent.current = true;
    send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const digits = code.replace(/\D/g, "");
    if (digits.length !== 6) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    startVerify(async () => {
      setError(null);
      setNotice(null);
      // On success the action redirects into the admin panel.
      const res = await verifyAdminCode(digits, nextPath);
      if (res && !res.ok) {
        setError(res.message);
        setCode("");
        inputRef.current?.focus();
      }
    });
  }

  return (
    <div className="mt-7 space-y-5">
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label htmlFor="code" className="eyebrow block text-ink-600">Sign-in code</label>
          <input
            ref={inputRef}
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            autoComplete="one-time-code"
            autoFocus
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            aria-describedby={error ? "verify-error" : notice ? "verify-notice" : undefined}
            className="mt-2 h-14 w-full rounded-full border border-cream-300 bg-white px-5 text-center font-display text-2xl tracking-[0.4em] tabular-nums focus-visible:border-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          />
        </div>

        {error && (
          <p id="verify-error" role="alert" className="rounded-2xl bg-wine-700/10 px-4 py-3 text-xs text-wine-800">
            {error}
          </p>
        )}
        {notice && !error && (
          <p id="verify-notice" role="status" className="rounded-2xl bg-cream-100 px-4 py-3 text-xs text-ink-600">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={verifying || code.length !== 6}
          className="grid h-12 w-full place-items-center rounded-full bg-ink-900 text-sm font-medium text-cream-50 transition-colors hover:bg-wine-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
        >
          {verifying ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Verify and continue"}
        </button>
      </form>

      <div className="flex flex-col items-center gap-3 border-t border-cream-300 pt-5 text-xs">
        <button
          type="button"
          onClick={send}
          disabled={sending || cooldown > 0}
          className="rounded-full px-3 py-1.5 font-medium text-ink-900 underline-offset-4 hover:text-wine-700 hover:underline disabled:text-ink-400 disabled:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          {sending ? "Sending…" : cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </button>
        <button
          type="button"
          onClick={() => startSignOut(() => signOutAdmin())}
          disabled={signingOut}
          className="rounded-full px-3 py-1.5 text-ink-600 underline-offset-4 hover:text-wine-700 hover:underline disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          {signingOut ? "Signing out…" : "Use a different account / sign out"}
        </button>
      </div>
    </div>
  );
}
