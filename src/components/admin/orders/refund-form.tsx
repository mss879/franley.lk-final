"use client";

import { useActionState, useState } from "react";
import { refundViaPayHere, type ActionState } from "@/app/admin/(guarded)/orders/actions";
import { ActionFeedback, SubmitButton, inputClass, labelClass } from "./form-bits";
import { formatPrice } from "@/lib/utils";

/**
 * "Refund via PayHere" on a paid card order. A full refund of the order total;
 * the browser confirm is the last chance to stop real money moving.
 */
export function RefundForm({
  orderId,
  orderNumber,
  totalCents,
  canCancel,
  shipped,
  enabled,
}: {
  orderId: string;
  orderNumber: string;
  totalCents: number;
  /** Still pending, confirmed, packed or shipped — so it can also be cancelled with restock. */
  canCancel: boolean;
  /** Already with the courier: restocking would count pieces that are not on the shelf. */
  shipped: boolean;
  /** PAYHERE_APP_ID and PAYHERE_APP_SECRET are set. */
  enabled: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(refundViaPayHere, null);
  // Controlled: React resets uncontrolled fields after every submission, failed ones included.
  const [reason, setReason] = useState("");

  if (!enabled) {
    return (
      <p className="mt-4 border-t border-cream-300 pt-4 text-xs leading-relaxed text-ink-600">
        To refund from here, set PAYHERE_APP_ID and PAYHERE_APP_SECRET (on the live account PayHere must
        also whitelist this server&rsquo;s IP). Until then, refund in the PayHere dashboard and mark the
        payment refunded above.
      </p>
    );
  }

  if (state?.ok) {
    return (
      <div className="mt-4 border-t border-cream-300 pt-4">
        <ActionFeedback state={state} />
      </div>
    );
  }

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`Refund ${formatPrice(totalCents)} to the customer's card for ${orderNumber}? This cannot be undone.`)) {
          e.preventDefault();
        }
      }}
      className="mt-4 space-y-3 border-t border-cream-300 pt-4"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <div>
        <label htmlFor="refund-reason" className={labelClass}>Refund reason</label>
        <input
          id="refund-reason"
          name="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          minLength={3}
          maxLength={200}
          placeholder="e.g. Out of stock, customer cancelled"
          className={`${inputClass} mt-2`}
        />
      </div>
      {canCancel && (
        <label className="flex items-center gap-2 text-xs text-ink-600">
          <input type="checkbox" name="cancelAndRestock" defaultChecked={!shipped} className="h-4 w-4 accent-ink-900" />
          {shipped
            ? "Also cancel the order and return its stock — only once the parcel is back"
            : "Also cancel the order and return its stock"}
        </label>
      )}
      <SubmitButton variant="outline" size="sm" className="w-full">
        Refund {formatPrice(totalCents)} via PayHere
      </SubmitButton>
      <ActionFeedback state={state} />
    </form>
  );
}
