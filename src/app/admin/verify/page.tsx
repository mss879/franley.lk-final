import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getAuthSession, readAdminMfaStatus } from "@/lib/supabase/admin-guard";
import { createServiceClient } from "@/lib/supabase/server";
import { VerifyForm } from "./verify-form";
import { safeAdminNext } from "./next-path";

export const metadata: Metadata = {
  title: "Verify Sign In",
  robots: { index: false, follow: false },
};

/** "s•••r@franley.lk" — enough to recognise the inbox, not to harvest it. */
function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "your email";
  const shown = local.length <= 2 ? local[0] : `${local[0]}•••${local[local.length - 1]}`;
  return `${shown}@${domain}`;
}

/**
 * Second step of the admin sign-in (0022_admin_email_2fa.sql). Reachable when
 * signed in but not yet verified; outside the (guarded) group because the
 * guarded layout's requireAdmin() is what sends people here.
 */
export default async function AdminVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const { supabase, user, sessionId } = await getAuthSession();
  if (!user) redirect("/admin/login");

  const status = await readAdminMfaStatus(supabase);
  // Not an admin, or 0022 not run: /admin's own gate decides what happens.
  if (!status || status === "legacy") redirect("/admin");
  if (status.sessionVerified) redirect(safeAdminNext(next));

  // Whether a live code already exists for this session, so a reload does not
  // send another email. Read with the service key: the table has no client grants.
  let hasActiveCode = false;
  let serverReady = true;
  if (sessionId) {
    try {
      const { data } = await createServiceClient()
        .from("admin_mfa_codes")
        .select("session_id")
        .eq("session_id", sessionId)
        .gt("expires_at", new Date().toISOString())
        .lt("attempts", 5)
        .maybeSingle();
      hasActiveCode = Boolean(data);
    } catch {
      serverReady = false;
    }
  }

  return (
    <main className="focus-on-dark silk-texture grid min-h-dvh place-items-center bg-ink-900 px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <Image
            src="/brand/logo-dark.png"
            alt="Franley"
            width={200}
            height={40}
            preload
            className="mx-auto h-8 w-auto brightness-0 invert"
          />
          <p className="eyebrow mt-6 text-champagne-300">Store administration</p>
        </div>

        <div className="mt-8 rounded-3xl bg-cream-50 p-8">
          <h1 className="font-display text-2xl">Check your email</h1>
          <p className="mt-2 text-sm text-ink-600">
            Enter the 6-digit code we sent to{" "}
            <span className="font-medium text-ink-900">{maskEmail(user.email ?? "")}</span>.
          </p>
          <VerifyForm
            nextPath={next}
            autoSend={!hasActiveCode}
            initialError={
              !sessionId
                ? "Your session could not be read. Sign out and sign in again."
                : !serverReady
                  ? "Two-step sign-in is not set up on the server (SUPABASE_SERVICE_ROLE_KEY is missing)."
                  : undefined
            }
          />
        </div>

        <p className="mt-6 text-center text-xs text-cream-100/60">
          Staff access only. All actions are logged.
        </p>
      </div>
    </main>
  );
}
