"use client";

import { useActionState } from "react";
import { releaseStaleCardOrders, type ActionState } from "@/app/admin/(guarded)/orders/actions";
import { ActionFeedback, SubmitButton, inputClass } from "./form-bits";

/**
 * Shown on the "Awaiting card payment" view. Card orders take stock when they
 * are placed; a shopper who abandons the PayHere page would hold it forever.
 */
export function ReleaseStaleForm() {
  const [state, action] = useActionState<ActionState, FormData>(releaseStaleCardOrders, null);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        const hours = new FormData(e.currentTarget).get("hours");
        if (!window.confirm(`Cancel every pending, unpaid card order older than ${hours} hours and return its stock?`)) {
          e.preventDefault();
        }
      }}
      className="mt-6 rounded-2xl border border-cream-300 bg-cream-100 px-5 py-4"
    >
      <p className="text-sm text-ink-800">Release abandoned card orders</p>
      <p className="mt-1 text-xs leading-relaxed text-ink-600">
        These orders were placed but never paid, and their pieces are off the shelf until you act. Releasing
        cancels the ones still pending and puts the stock back — an unpaid order you have already confirmed is
        left for you to handle. The customer is not emailed; they were never charged.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label htmlFor="release-hours" className="text-xs text-ink-600">Older than</label>
        <input
          id="release-hours"
          name="hours"
          type="number"
          min={1}
          max={720}
          defaultValue={24}
          className={`${inputClass} w-24`}
        />
        <span className="text-xs text-ink-600">hours</span>
        <SubmitButton variant="outline" size="sm">Release and restock</SubmitButton>
      </div>
      <ActionFeedback state={state} className="mt-2" />
    </form>
  );
}
