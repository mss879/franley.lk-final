"use client";

import { useActionState } from "react";
import { saveSettingsGroup } from "@/app/admin/(guarded)/settings/actions";
import { READ_ONLY_KEYS, type SettingRow, type SettingsState } from "@/app/admin/(guarded)/settings/shared";
import { FormSection, SelectField, TextAreaField, TextField } from "@/components/admin/products/fields";
import { SubmitButton } from "@/components/admin/orders/form-bits";
import { Pill } from "@/components/admin/content/ui";
import { formatPrice, cn } from "@/lib/utils";

/** What the input shows for a stored value — money is edited in rupees, not cents. */
function display(row: SettingRow, value: unknown): string {
  if (row.value_type === "money_cents") return typeof value === "number" ? (value / 100).toFixed(2) : "";
  if (value === null || value === undefined) return "";
  return String(value);
}

function Field({ row, error, typed }: { row: SettingRow; error?: string; typed?: string }) {
  const id = `setting-${row.key.replace(/\./g, "-")}`;
  const name = `s:${row.key}`;
  const readOnly = READ_ONLY_KEYS.includes(row.key);
  const hint =
    row.value_type === "money_cents" && typeof row.value === "number"
      ? `${row.help ? `${row.help.replace(/In cents:[^.]*\.\s*/i, "")} ` : ""}Currently ${formatPrice(row.value)}.`
      : row.help ?? undefined;

  const resetToDefault = () => {
    const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    if (!el || row.default_value === undefined) return;
    if (row.value_type === "boolean") (el as HTMLInputElement).checked = row.default_value === true;
    else el.value = display(row, row.default_value);
  };

  // After a failed save, show what was typed rather than snapping back to the stored value.
  const initial = typed ?? display(row, row.value);
  const label = row.value_type === "money_cents" ? `${row.label.replace(/\s*\(cents\)/i, "")} (Rs)` : row.label;
  const wide = row.value_type === "textarea";

  const control =
    row.value_type === "boolean" ? (
      <div className="space-y-1.5">
        <label htmlFor={id} className="flex cursor-pointer items-center gap-3 text-sm text-ink-800">
          <input
            id={id}
            name={name}
            type="checkbox"
            defaultChecked={typed !== undefined ? typed === "on" : row.value === true}
            disabled={readOnly}
            className="h-4 w-4 accent-[#711625]"
          />
          {row.label}
        </label>
        {error ? <p className="text-xs text-wine-700">{error}</p> : row.help && <p className="text-xs text-ink-600">{row.help}</p>}
      </div>
    ) : row.value_type === "textarea" ? (
      <TextAreaField id={id} name={name} label={label} hint={hint} error={error} defaultValue={initial} readOnly={readOnly} rows={5} />
    ) : row.value_type === "select" ? (
      <SelectField id={id} name={name} label={label} hint={hint} error={error} defaultValue={initial} disabled={readOnly}>
        {(row.options ?? []).map((o) => {
          const value = typeof o === "string" ? o : String(o?.value ?? "");
          const text = typeof o === "string" ? o : o?.label ?? value;
          return <option key={value} value={value}>{text}</option>;
        })}
      </SelectField>
    ) : (
      <TextField
        id={id}
        name={name}
        label={label}
        hint={hint}
        error={error}
        defaultValue={initial}
        readOnly={readOnly}
        type={row.value_type === "email" ? "email" : row.value_type === "url" ? "url" : row.value_type === "phone" ? "tel" : "text"}
        inputMode={row.value_type === "number" ? "numeric" : row.value_type === "money_cents" ? "decimal" : undefined}
      />
    );

  return (
    <div className={cn("space-y-2", wide && "sm:col-span-2")}>
      {/* Marks the field as rendered, so an unchecked box still counts as "off". */}
      {!readOnly && <input type="hidden" name={`present:${row.key}`} value="1" />}
      {control}
      <div className="flex flex-wrap items-center gap-2">
        {!row.is_public && <Pill tone="locked">Not shown to shoppers</Pill>}
        {readOnly && <Pill tone="locked">Fixed</Pill>}
        {!readOnly && row.default_value !== undefined && row.default_value !== null && (
          <button
            type="button"
            onClick={resetToDefault}
            className="text-xs text-ink-600 underline underline-offset-2 hover:text-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            Reset to default
          </button>
        )}
      </div>
    </div>
  );
}

export function SettingsGroupForm({
  group,
  title,
  description,
  rows,
}: {
  group: string;
  title: string;
  description: string;
  rows: SettingRow[];
}) {
  const [state, action] = useActionState<SettingsState, FormData>(saveSettingsGroup, null);

  return (
    <form action={action}>
      <input type="hidden" name="group" value={group} />
      <FormSection title={title} description={description}>
        {rows.map((row) => (
          <Field key={row.key} row={row} error={state?.fieldErrors?.[row.key]} typed={state?.values?.[row.key]} />
        ))}
        <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
          <SubmitButton size="sm">Save {title.toLowerCase()}</SubmitButton>
          <div aria-live="polite" className="min-h-5">
            {state && (
              <p className={cn("text-xs leading-relaxed", state.ok ? "text-wine-700" : "text-wine-800")}>
                {!state.ok && <span className="font-medium">Not saved — </span>}
                {state.message}
              </p>
            )}
          </div>
        </div>
      </FormSection>
    </form>
  );
}
