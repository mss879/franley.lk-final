"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteOrder, type ActionState } from "@/app/admin/(guarded)/orders/actions";
import { Button } from "@/components/ui/button";
import { ActionFeedback, SubmitButton } from "./form-bits";

const dangerButton =
  "bg-wine-800 text-cream-50 hover:bg-wine-700 active:bg-wine-800 ring-offset-cream-50";

/**
 * Shown on the order page only for an order admin_delete_order (0021) will
 * accept: cancelled, or never paid and not yet shipped. Two steps, because
 * there is no undo — on success the action redirects to the orders list.
 */
export function OrderDeleteForm({
  orderId,
  orderNumber,
  cancelled,
}: {
  orderId: string;
  orderNumber: string;
  cancelled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(deleteOrder, null);

  return (
    <div className="rounded-2xl border border-wine-700/25 bg-wine-700/[0.04] p-5">
      <h3 className="font-display text-lg text-wine-800">Delete this order</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-600">
        For fake, test and cancelled orders. It removes the order, its items, history and email
        log for good. Paid, refunded and shipped orders can never be deleted.
      </p>

      {!open ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4 border-wine-700/40 text-wine-800 hover:border-wine-700 hover:text-wine-700"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          aria-controls="delete-panel"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
          Delete order
        </Button>
      ) : (
        <form id="delete-panel" action={formAction} className="mt-4 space-y-4">
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="redirectToList" value="1" />

          <div className="rounded-2xl border border-wine-700/25 bg-white px-4 py-3 text-xs leading-relaxed text-ink-800">
            <p className="font-medium text-wine-800">
              Delete {orderNumber} permanently? This cannot be undone.
            </p>
            <p className="mt-1.5 text-ink-600">
              {cancelled
                ? "Its stock was settled when it was cancelled, so stock is not touched again."
                : "It is cancelled first and every line goes back to its product's stock."}{" "}
              The customer is not emailed, and their order count and totals are recalculated.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <SubmitButton size="sm" className={dangerButton}>
              Delete permanently
            </SubmitButton>
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

/**
 * The compact version for a row on the orders list. Confirms in the browser,
 * then deletes in place; the list revalidates and the row disappears.
 */
export function OrderRowDelete({ orderId, orderNumber }: { orderId: string; orderNumber: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(deleteOrder, null);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(`Delete ${orderNumber} permanently? This cannot be undone.`)) {
          e.preventDefault();
        }
      }}
      className="flex flex-col items-end gap-1"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <SubmitButton
        variant="ghost"
        size="sm"
        className="h-8 w-8 px-0 text-ink-600 hover:bg-wine-700/8 hover:text-wine-700"
        aria-label={`Delete order ${orderNumber}`}
        title={`Delete ${orderNumber}`}
      >
        <Trash2 className="h-4 w-4" strokeWidth={1.5} aria-hidden />
      </SubmitButton>
      {state && !state.ok && (
        <p role="alert" className="max-w-56 text-right text-[11px] leading-snug text-wine-800">
          {state.message}
        </p>
      )}
    </form>
  );
}
