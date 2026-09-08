"use client";

import { useActionState } from "react";
import { updateOrderStatus, type ActionState } from "@/app/admin/(guarded)/orders/actions";
import { ADVANCE_VERB, ORDER_STATUS_LABEL, type OrderStatus } from "./status";
import { ActionFeedback, SubmitButton, inputClass, labelClass } from "./form-bits";

export function OrderStatusControls({
  orderId,
  status,
  nextStatuses,
}: {
  orderId: string;
  status: OrderStatus;
  nextStatuses: OrderStatus[];
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(updateOrderStatus, null);

  if (nextStatuses.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-ink-600">
        {ORDER_STATUS_LABEL[status]} is where this order ends. Nothing further can be recorded
        against it — raise a new order if the customer buys again.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="orderId" value={orderId} />

      <div>
        <label htmlFor="status-note" className={labelClass}>
          Note for the log
        </label>
        <input
          id="status-note"
          name="note"
          type="text"
          maxLength={500}
          placeholder="Optional — collected by Pronto, 4pm"
          className={`${inputClass} mt-2`}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {nextStatuses.map((next, i) => (
          <SubmitButton
            key={next}
            name="status"
            value={next}
            size="sm"
            variant={i === 0 ? "primary" : "outline"}
          >
            {ADVANCE_VERB[next]}
          </SubmitButton>
        ))}
      </div>

      <ActionFeedback state={state} />
    </form>
  );
}
