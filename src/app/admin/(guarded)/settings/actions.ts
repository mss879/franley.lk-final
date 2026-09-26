"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/admin-guard";
import { createClient } from "@/lib/supabase/server";
import { EDITABLE_GROUPS, HIDDEN_KEYS, READ_ONLY_KEYS, type SettingRow, type SettingsState } from "./shared";

/**
 * Validates one submitted value against the type the ROW declares — re-read
 * from the database, never taken from the form, so a tampered request cannot
 * store a string where checkout arithmetic expects cents.
 */
function parseValue(row: SettingRow, raw: FormDataEntryValue | null): { ok: true; value: unknown } | { ok: false; error: string } {
  const text = typeof raw === "string" ? raw.trim() : "";

  switch (row.value_type) {
    case "boolean":
      return { ok: true, value: raw === "on" };

    case "number": {
      // Every number setting is a checkout limit, and 0 would refuse every order.
      const n = Number(text);
      if (!text || !Number.isInteger(n) || n < 1 || n > 1_000_000) {
        return { ok: false, error: "Enter a whole number from 1 to 1,000,000." };
      }
      return { ok: true, value: n };
    }

    case "money_cents": {
      // Typed in rupees, stored in cents — the unit place_order works in.
      const n = Number(text.replace(/,/g, ""));
      if (!text || !Number.isFinite(n) || n < 0 || n > 10_000_000) {
        return { ok: false, error: "Enter an amount in rupees, e.g. 350 or 350.00." };
      }
      return { ok: true, value: Math.round(n * 100) };
    }

    case "url":
      if (text && !z.url({ protocol: /^https$/ }).safeParse(text).success) {
        return { ok: false, error: "Use a full https:// address, or leave it empty." };
      }
      return { ok: true, value: text };

    case "email":
      if (text && !z.email().safeParse(text).success) return { ok: false, error: "That is not a valid email address." };
      return { ok: true, value: text };

    case "phone":
      if (text && !/^\+?[0-9 ()-]{7,20}$/.test(text)) {
        return { ok: false, error: "Digits, spaces and an optional leading + only, e.g. +94 70 750 7722." };
      }
      return { ok: true, value: text };

    case "select": {
      const allowed = (row.options ?? []).map((o) => (typeof o === "string" ? o : String(o?.value ?? "")));
      if (!allowed.includes(text)) return { ok: false, error: "Choose one of the listed options." };
      return { ok: true, value: text };
    }

    case "textarea":
      if (text.length > 4000) return { ok: false, error: "Keep this under 4,000 characters." };
      return { ok: true, value: text };

    default:
      if (text.length > 500) return { ok: false, error: "Keep this under 500 characters." };
      return { ok: true, value: text };
  }
}

/** Saves every setting in one group. Only values that actually changed are written. */
export async function saveSettingsGroup(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const admin = await requireAdmin();

  const group = String(formData.get("group") ?? "");
  if (!(EDITABLE_GROUPS as readonly string[]).includes(group)) {
    return { ok: false, message: "That settings group cannot be edited here." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_settings")
    .select("key, group_key, label, help, value_type, options, value, default_value, is_public, is_locked, position")
    .eq("group_key", group);
  if (error) return { ok: false, message: error.message };

  const rows = (data ?? []) as SettingRow[];
  const fieldErrors: Record<string, string> = {};
  const values: Record<string, string> = {};
  const changes: { key: string; value: unknown }[] = [];

  for (const row of rows) {
    if (READ_ONLY_KEYS.includes(row.key) || HIDDEN_KEYS.includes(row.key)) continue;
    // A field the form did not render (e.g. a row added after the page loaded) is left alone.
    if (formData.get(`present:${row.key}`) === null) continue;

    const raw = formData.get(`s:${row.key}`);
    values[row.key] = typeof raw === "string" ? raw : "";
    const parsed = parseValue(row, raw);
    if (!parsed.ok) {
      fieldErrors[row.key] = parsed.error;
      continue;
    }
    if (JSON.stringify(parsed.value) !== JSON.stringify(row.value)) changes.push({ key: row.key, value: parsed.value });
  }

  if (Object.keys(fieldErrors).length) {
    return { ok: false, message: "Fix the highlighted fields and save again.", fieldErrors, values };
  }
  if (!changes.length) return { ok: true, message: "Nothing to save — no values changed." };

  for (const change of changes) {
    const { error: updateError } = await supabase
      .from("site_settings")
      .update({ value: change.value, updated_by: admin.userId })
      .eq("key", change.key);
    if (updateError) {
      return {
        ok: false,
        message:
          updateError.code === "42501"
            ? "Your account is not allowed to change settings."
            : `Could not save ${change.key}: ${updateError.message}`,
        values,
      };
    }
  }

  // Header, footer, bag, checkout and emails all read these.
  revalidatePath("/", "layout");
  revalidatePath("/admin/settings");
  return { ok: true, message: `Saved ${changes.length} change${changes.length === 1 ? "" : "s"}. The storefront is updated.` };
}
