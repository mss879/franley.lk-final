"use client";

import { useActionState } from "react";
import {
  saveAdminNote,
  saveTrackingNumber,
  type ActionState,
} from "@/app/admin/(guarded)/orders/actions";
import { ActionFeedback, SubmitButton, inputClass, labelClass, textareaClass } from "./form-bits";

export function AdminNoteForm({ orderId, note }: { orderId: string; note: string | null }) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveAdminNote, null);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <label htmlFor="admin-note" className={labelClass}>
        Internal note
      </label>
      <textarea
        id="admin-note"
        name="adminNote"
        rows={4}
        maxLength={2000}
        defaultValue={note ?? ""}
        placeholder="Only the team sees this. Never shown to the customer."
        className={textareaClass}
      />
      <div className="flex items-center gap-3">
        <SubmitButton size="sm" variant="outline">
          Save note
        </SubmitButton>
        <ActionFeedback state={state} className="flex-1" />
      </div>
    </form>
  );
}

export function TrackingForm({
  orderId,
  trackingNumber,
}: {
  orderId: string;
  trackingNumber: string | null;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveTrackingNumber, null);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <label htmlFor="tracking-number" className={labelClass}>
        Tracking number
      </label>
      <input
        id="tracking-number"
        name="trackingNumber"
        type="text"
        maxLength={80}
        defaultValue={trackingNumber ?? ""}
        placeholder="Courier reference"
        className={inputClass}
      />
      <div className="flex items-center gap-3">
        <SubmitButton size="sm" variant="outline">
          Save tracking
        </SubmitButton>
        <ActionFeedback state={state} className="flex-1" />
      </div>
    </form>
  );
}
