"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/admin-guard";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { pushEnabled, sendToSubscriptions } from "@/lib/push";

export type PushActionResult = { ok: boolean; message: string };

/** What PushSubscription.toJSON() gives, checked before it reaches the database. */
const subscriptionSchema = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(2000),
  keys: z.object({
    p256dh: z.string().min(20).max(200),
    auth: z.string().min(8).max(100),
  }),
});

/** "iPhone · Safari" — enough to tell devices apart in the list. */
function deviceLabel(ua: string) {
  const device = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua) || (/Macintosh/.test(ua) && /Mobile\//.test(ua))
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Macintosh/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : /Linux/.test(ua)
              ? "Linux"
              : "Device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\/|FxiOS/.test(ua)
      ? "Firefox"
      : /Chrome\/|CriOS/.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua) || /iPhone|iPad/.test(ua)
          ? "Safari"
          : null;
  return browser ? `${device} · ${browser}` : device;
}

/** Turns alerts on for the device the admin is using. */
export async function savePushSubscription(subscription: unknown): Promise<PushActionResult> {
  await requireAdmin();
  if (!pushEnabled()) return { ok: false, message: "Order alerts are not set up on the server yet (VAPID keys are missing)." };

  const parsed = subscriptionSchema.safeParse(subscription);
  if (!parsed.success) return { ok: false, message: "This browser returned a subscription the store cannot use." };

  const ua = (await headers()).get("user-agent") ?? "";
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: parsed.data.endpoint,
    p_p256dh: parsed.data.keys.p256dh,
    p_auth: parsed.data.keys.auth,
    p_label: deviceLabel(ua),
  });
  if (error) {
    console.error("save_push_subscription failed", error);
    return {
      ok: false,
      message:
        error.code === "PGRST202" || error.code === "42883"
          ? "The database is missing order alerts. Run supabase/migrations/0017_push_notifications.sql."
          : "Could not turn alerts on. Please try again.",
    };
  }

  revalidatePath("/admin/settings");
  return { ok: true, message: "Order alerts are on for this device." };
}

/** Turns alerts off for one of the admin's own devices — this one, or one listed. */
export async function removePushSubscription(target: { endpoint?: string; id?: string }): Promise<PushActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  let query = supabase.from("admin_push_subscriptions").delete();
  if (target.id && z.uuid().safeParse(target.id).success) query = query.eq("id", target.id);
  else if (target.endpoint && target.endpoint.length <= 2000) query = query.eq("endpoint", target.endpoint);
  else return { ok: false, message: "Nothing to remove." };

  // RLS limits the delete to the admin's own rows.
  const { error } = await query;
  if (error) {
    console.error("remove push subscription failed", error);
    return { ok: false, message: "Could not turn alerts off. Please try again." };
  }

  revalidatePath("/admin/settings");
  return { ok: true, message: "Order alerts are off for that device." };
}

/** Sends a test alert to the device the admin is using, so they can see it ring. */
export async function sendTestPush(endpoint: string): Promise<PushActionResult> {
  const admin = await requireAdmin();
  if (!pushEnabled()) return { ok: false, message: "Order alerts are not set up on the server yet (VAPID keys are missing)." };
  if (typeof endpoint !== "string" || !endpoint || endpoint.length > 2000) return { ok: false, message: "Nothing to test." };

  // The keys are not readable with the admin's own session (0017), so the
  // server looks them up — for this admin's own device only.
  const { data, error } = await createServiceClient()
    .from("admin_push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", admin.userId)
    .eq("endpoint", endpoint)
    .maybeSingle();
  if (error || !data) return { ok: false, message: "This device is not registered. Turn alerts off and on again." };

  const { sent } = await sendToSubscriptions([data], {
    title: "Order alerts are working",
    body: "This is how a new order will look on this device.",
    url: "/admin/orders",
    tag: "franley-test",
  });

  revalidatePath("/admin/settings");
  return sent
    ? { ok: true, message: "Test alert sent. It should appear in a few seconds." }
    : { ok: false, message: "The push service refused the test alert. Turn alerts off and on again." };
}
