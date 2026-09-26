import type { Metadata } from "next";
import { AdminPageShell } from "@/components/admin/page-shell";
import { SettingsGroupForm } from "@/components/admin/settings/settings-group-form";
import { requireAdmin } from "@/lib/supabase/admin-guard";
import { createClient } from "@/lib/supabase/server";
import { EDITABLE_GROUPS, GROUP_COPY, HIDDEN_KEYS, type SettingRow } from "./shared";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

/**
 * Renders public.site_settings as forms. Each row carries its own label, help,
 * type and options (0004_media_and_cms.sql), so a setting added in SQL shows up
 * here without a code change. The integrations group holds secrets and is
 * never loaded.
 */
export default async function SettingsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("site_settings")
    .select("key, group_key, label, help, value_type, options, value, default_value, is_public, is_locked, position")
    .in("group_key", [...EDITABLE_GROUPS])
    .order("position");

  const rows = ((data ?? []) as SettingRow[]).filter((r) => !HIDDEN_KEYS.includes(r.key));

  return (
    <AdminPageShell
      title="Settings"
      description="Contact details, delivery charges, bank transfer instructions and the checkout switch. Changes reach the storefront as soon as you save."
    >
      {error ? (
        <p role="alert" className="rounded-2xl bg-wine-700/10 px-4 py-3 text-sm text-wine-800">
          Could not load settings: {error.message}
        </p>
      ) : !rows.length ? (
        <p className="rounded-2xl border border-dashed border-cream-300 px-6 py-10 text-center text-sm text-ink-600">
          No settings found. Run supabase/migrations/0009_seed_cms.sql to create them.
        </p>
      ) : (
        <div className="space-y-6">
          {EDITABLE_GROUPS.map((group) => {
            const groupRows = rows.filter((r) => r.group_key === group);
            if (!groupRows.length) return null;
            return (
              <SettingsGroupForm
                key={group}
                group={group}
                title={GROUP_COPY[group].title}
                description={GROUP_COPY[group].description}
                rows={groupRows}
              />
            );
          })}
        </div>
      )}
    </AdminPageShell>
  );
}
