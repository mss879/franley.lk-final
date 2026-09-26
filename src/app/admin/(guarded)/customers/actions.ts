"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/admin-guard";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { ok: boolean; message: string } | null;

const noteSchema = z.object({
  id: z.uuid("That customer reference is not valid."),
  notes: z.string().max(2000, "Keep the note under 2000 characters."),
});

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function firstIssue(error: z.ZodError): ActionState {
  return { ok: false, message: error.issues[0]?.message ?? "Check the form and try again." };
}

/**
 * `notes` is the only column `authenticated` may UPDATE on customers — the
 * contact details and the figures are the database's, kept by place_order and
 * the stats trigger. Rows are never created or deleted from here.
 */
export async function saveCustomerNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const parsed = noteSchema.safeParse({
    id: field(formData, "id"),
    notes: field(formData, "notes"),
  });
  if (!parsed.success) return firstIssue(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .update({ notes: parsed.data.notes || null })
    .eq("id", parsed.data.id)
    .select("id");

  if (error) {
    // 42501 is Postgres' insufficient_privilege: the column grant from 0014
    // is missing, or the caller is not an admin after all.
    return {
      ok: false,
      message:
        error.code === "42501" ? "Your account is not allowed to edit customers." : error.message,
    };
  }
  // RLS filters rather than refuses, so a vanished row updates nothing and
  // reports no error. Say so instead of claiming the note was saved.
  if (!data || data.length === 0) {
    return { ok: false, message: "That customer could not be found." };
  }

  revalidatePath(`/admin/customers/${parsed.data.id}`);
  return { ok: true, message: parsed.data.notes ? "Note saved." : "Note cleared." };
}
