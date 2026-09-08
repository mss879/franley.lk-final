"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { submitEnquiry, type ContactState } from "@/app/(shop)/contact/actions";
import { cn } from "@/lib/utils";

const FIELDS = [
  { id: "name", label: "Your name", type: "text", autoComplete: "name", required: true },
  { id: "email", label: "Email", type: "email", autoComplete: "email", required: true },
  { id: "phone", label: "Phone (optional)", type: "tel", autoComplete: "tel", required: false },
  { id: "orderNumber", label: "Order number (optional)", type: "text", autoComplete: "off", required: false },
] as const;

const inputClass =
  "mt-2 h-12 w-full rounded-full border border-cream-300 bg-cream-50 px-5 text-sm " +
  "focus-visible:border-wine-700 focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-[--focus-ring] focus-visible:ring-offset-2";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-7 grid h-14 w-full place-items-center rounded-full bg-wine-700 text-sm font-medium text-cream-50 transition-colors hover:bg-wine-600 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--focus-ring] focus-visible:ring-offset-2"
    >
      {pending ? (
        <span className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Sending…
        </span>
      ) : (
        "Send message"
      )}
    </button>
  );
}

export function ContactForm() {
  const [state, formAction] = useActionState<ContactState, FormData>(submitEnquiry, null);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the form once it has actually been delivered, so a second enquiry
  // does not resend the first one's text.
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="h-fit rounded-3xl border border-cream-300 bg-cream-100 p-7 md:p-9"
    >
      <h2 className="font-display text-2xl">Send a message</h2>
      <p className="mt-2 text-sm text-ink-600">
        We reply within a few hours during business hours.
      </p>

      <div className="mt-7 space-y-5">
        {FIELDS.map((f) => (
          <div key={f.id}>
            <label htmlFor={f.id} className="eyebrow block text-ink-600">
              {f.label}
            </label>
            <input
              id={f.id}
              name={f.id}
              type={f.type}
              autoComplete={f.autoComplete}
              required={f.required}
              maxLength={120}
              className={inputClass}
            />
          </div>
        ))}

        <div>
          <label htmlFor="message" className="eyebrow block text-ink-600">
            How can we help?
          </label>
          <textarea
            id="message"
            name="message"
            rows={5}
            required
            maxLength={2000}
            className="mt-2 w-full rounded-2xl border border-cream-300 bg-cream-50 px-5 py-4 text-sm focus-visible:border-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--focus-ring] focus-visible:ring-offset-2"
          />
        </div>

        {/* Honeypot. Hidden from sight and from assistive tech, so only a bot
            ever fills it. */}
        <div aria-hidden className="absolute left-[-9999px] h-px w-px overflow-hidden">
          <label htmlFor="website">Leave this field empty</label>
          <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>
      </div>

      {state && (
        <p
          role="status"
          aria-live="polite"
          className={cn(
            "mt-6 rounded-2xl px-4 py-3 text-sm",
            state.ok ? "bg-wine-700/8 text-wine-800" : "bg-wine-700/12 text-wine-800",
          )}
        >
          {state.message}
        </p>
      )}

      <Submit />
    </form>
  );
}
