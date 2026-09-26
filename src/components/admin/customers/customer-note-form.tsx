"use client";

import { useActionState, useState } from "react";
import { saveCustomerNote, type ActionState } from "@/app/admin/(guarded)/customers/actions";
import {
  ActionFeedback,
  SubmitButton,
  labelClass,
  textareaClass,
} from "@/components/admin/orders/form-bits";

export function CustomerNoteForm({ customerId, notes }: { customerId: string; notes: string | null }) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveCustomerNote, null);
  // Controlled, so a failed save does not throw away what was typed (React resets
  // uncontrolled fields after every action).
  const [value, setValue] = useState(notes ?? "");

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={customerId} />
      <label htmlFor="customer-notes" className={labelClass}>
        Team note
      </label>
      <textarea
        id="customer-notes"
        name="notes"
        rows={5}
        maxLength={2000}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Sizes, preferences, how they like to be reached. Only the team sees this."
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
