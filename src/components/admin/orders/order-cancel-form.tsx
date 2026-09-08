"use client";

import { useActionState, useState } from "react";
import { cancelOrder, type ActionState } from "@/app/admin/(guarded)/orders/actions";
import { Button } from "@/components/ui/button";
import { ActionFeedback, SubmitButton, inputClass, labelClass } from "./form-bits";

export function OrderCancelForm({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(cancelOrder, null);

  return (
    <div className="rounded-2xl border border-cream-300 bg-cream-100 p-5">
      <h3 className="font-display text-lg">Cancel this order</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-600">
        Cancelling is permanent — the order stays on record, it does not disappear. Delivered
        orders are refunded instead.
      </p>

      {!open ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          aria-controls="cancel-panel"
        >
          Cancel order
        </Button>
      ) : (
        <form id="cancel-panel" action={formAction} className="mt-4 space-y-4">
          <input type="hidden" name="orderId" value={orderId} />

          <div>
            <label htmlFor="cancel-reason" className={labelClass}>
              Reason
            </label>
            <input
              id="cancel-reason"
              name="reason"
              type="text"
              maxLength={500}
              placeholder="Optional — customer changed their mind"
              className={`${inputClass} mt-2`}
            />
          </div>

          <div className="flex items-start gap-3">
            <input
              id="cancel-restock"
              name="restock"
              type="checkbox"
              defaultChecked
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-cream-300 accent-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
            />
            <label htmlFor="cancel-restock" className="text-xs leading-relaxed text-ink-600">
              <span className="text-sm text-ink-800">Return the stock</span>
              <br />
              Adds every line back to its product&rsquo;s stock count. Leave this off if the goods
              are already gone.
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <SubmitButton size="sm">Confirm cancellation</SubmitButton>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Keep the order
            </Button>
          </div>

          <ActionFeedback state={state} />
        </form>
      )}
    </div>
  );
}
