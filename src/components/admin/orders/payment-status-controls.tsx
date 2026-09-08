"use client";

import { useActionState } from "react";
import { updatePaymentStatus, type ActionState } from "@/app/admin/(guarded)/orders/actions";
import {
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  type PaymentStatus,
  type PaymentMethod,
} from "./status";
import { ActionFeedback, SubmitButton, inputClass, labelClass } from "./form-bits";

/**
 * Advancing the order status marks a cash-on-delivery order paid on delivery,
 * but nothing else can. This is the path for a bank transfer whose slip has
 * arrived, a refund, or a payment that failed.
 */
export function PaymentStatusControls({
  orderId,
  paymentStatus,
  paymentMethod,
}: {
  orderId: string;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(updatePaymentStatus, null);
  const options = PAYMENT_STATUSES.filter((s) => s !== paymentStatus);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="orderId" value={orderId} />

      <p className="text-sm leading-relaxed text-ink-600">
        Paying by <strong className="text-ink-900">{PAYMENT_METHOD_LABEL[paymentMethod]}</strong>,
        currently <strong className="text-ink-900">{PAYMENT_STATUS_LABEL[paymentStatus].toLowerCase()}</strong>.
      </p>

      <div>
        <label htmlFor="payment-note" className={labelClass}>
          Note for the log
        </label>
        <input
          id="payment-note"
          name="note"
          type="text"
          maxLength={500}
          placeholder="Optional — transfer slip received on WhatsApp"
          className={`${inputClass} mt-2`}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {options.map((next) => (
          <SubmitButton
            key={next}
            name="paymentStatus"
            value={next}
            size="sm"
            variant={next === "paid" ? "primary" : "outline"}
          >
            Mark {PAYMENT_STATUS_LABEL[next].toLowerCase()}
          </SubmitButton>
        ))}
      </div>

      <ActionFeedback state={state} />
    </form>
  );
}
