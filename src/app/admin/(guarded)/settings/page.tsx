import type { Metadata } from "next";
import { AdminPageShell } from "@/components/admin/page-shell";
import { SettingsGroupForm } from "@/components/admin/settings/settings-group-form";
import { PushAlerts, type PushDevice } from "@/components/admin/settings/push-alerts";
import { pushPublicKey } from "@/lib/push";
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

  // This admin's own devices with order alerts on (RLS shows no one else's).
  const { data: devices, error: devicesError } = await supabase
    .from("admin_push_subscriptions")
    .select("id, endpoint, device_label, created_at, last_success_at, last_error")
    .order("created_at");
  const publicKey = pushPublicKey();
  const pushProblem = !publicKey
    ? "Order alerts are not set up on the server yet. Add VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to the site's environment variables (see DEPLOY.md), then redeploy."
    : devicesError
      ? devicesError.code === "42P01" || devicesError.code === "PGRST205"
        ? "The database is missing order alerts. Run supabase/migrations/0017_push_notifications.sql in the Supabase SQL Editor."
        : `Could not load your devices: ${devicesError.message}`
      : null;

  return (
    <AdminPageShell
      title="Settings"
      description="Order alerts on your phone, contact details, delivery charges, bank transfer instructions and the checkout switch. Changes reach the storefront as soon as you save."
    >
      <div className="mb-6">
        <PushAlerts publicKey={publicKey} devices={(devices ?? []) as PushDevice[]} setupProblem={pushProblem} />
      </div>

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
