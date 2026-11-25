import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./server";

export type AdminIdentity = {
  userId: string;
  email: string;
  role: "owner" | "admin";
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type AdminMfaStatus = {
  userId: string;
  email: string;
  role: "owner" | "admin";
  /** The emergency switch in admin_mfa_settings is on (the default). */
  mfaRequired: boolean;
  /** This Supabase session may act as admin: code entered, or 2FA switched off. */
  sessionVerified: boolean;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The signed-in user and their Supabase session id, both taken from
 * verified sources: getUser() asks the Auth server, getClaims() verifies the
 * access token's signature. The session id is what the database's
 * admin_mfa_sessions row — and so is_admin() — is keyed on.
 */
export async function getAuthSession() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, sessionId: null } as const;

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const sessionId =
    claims && claims.sub === user.id && typeof claims.session_id === "string" && UUID_RE.test(claims.session_id)
      ? claims.session_id
      : null;

  return { supabase, user, sessionId } as const;
}

/**
 * "Not an admin" (null), "admin, code pending" and "admin, verified" — kept
 * apart so an admin who has not entered their code is sent to /admin/verify
 * rather than signed out. "legacy" means 0022 has not been run yet: the
 * database still grants admin on the password alone, so the app does too
 * rather than locking the owner out of a half-deployed site.
 */
export async function readAdminMfaStatus(
  supabase: SupabaseServerClient,
): Promise<AdminMfaStatus | "legacy" | null> {
  const { data, error } = await supabase.rpc("admin_mfa_status");

  if (error) {
    // PGRST202: no such function in the schema cache — migration 0022 missing.
    if (error.code === "PGRST202") {
      console.warn("admin_mfa_status() is missing: run supabase/migrations/0022_admin_email_2fa.sql to turn on two-step sign-in.");
      return "legacy";
    }
    console.error("admin_mfa_status failed", error);
    return null;
  }

  const row = (Array.isArray(data) ? data[0] : data) as
    | { user_id?: string; email?: string; role?: "owner" | "admin"; mfa_required?: boolean; session_verified?: boolean }
    | null
    | undefined;
  if (!row?.user_id) return null;

  return {
    userId: row.user_id,
    email: row.email ?? "",
    role: row.role ?? "admin",
    mfaRequired: row.mfa_required !== false,
    sessionVerified: row.session_verified === true,
  };
}

/**
 * The single gate for every /admin page and server action.
 *
 * `proxy.ts` only checks that *someone* is signed in — it cannot cheaply ask
 * whether they are an admin. This does, via the `admin_mfa_status()` SECURITY
 * DEFINER function, so a signed-in non-admin gets bounced instead of seeing an
 * empty dashboard full of RLS-denied queries, and an admin who has not yet
 * entered the emailed code is sent to /admin/verify.
 *
 * This is UX. The database enforces the same rule: is_admin() is false for a
 * session that has not passed the code check (0022_admin_email_2fa.sql).
 */
export async function requireAdmin(): Promise<AdminIdentity> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const status = await readAdminMfaStatus(supabase);

  if (status === "legacy") {
    const { data, error } = await supabase.rpc("current_admin");
    const admin = (Array.isArray(data) ? data[0] : data) as
      | { user_id?: string; email?: string; role?: "owner" | "admin" }
      | null;
    if (error || !admin?.user_id) {
      await supabase.auth.signOut();
      redirect("/admin/login?error=not-admin");
    }
    return { userId: admin.user_id!, email: admin.email ?? user.email ?? "", role: admin.role ?? "admin" };
  }

  if (!status) {
    await supabase.auth.signOut();
    redirect("/admin/login?error=not-admin");
  }

  if (!status.sessionVerified) redirect("/admin/verify");

  return {
    userId: status.userId,
    email: status.email || user.email || "",
    role: status.role,
  };
}
