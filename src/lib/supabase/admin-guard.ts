import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./server";

export type AdminIdentity = {
  userId: string;
  email: string;
  role: "owner" | "admin";
};

/**
 * The single gate for every /admin page and server action.
 *
 * `proxy.ts` only checks that *someone* is signed in — it cannot cheaply ask
 * whether they are an admin. This does, via the `current_admin()` SECURITY
 * DEFINER function, so a signed-in non-admin gets bounced instead of seeing an
 * empty dashboard full of RLS-denied queries.
 */
export async function requireAdmin(): Promise<AdminIdentity> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data, error } = await supabase.rpc("current_admin");
  const admin = (Array.isArray(data) ? data[0] : data) as
    | { user_id?: string; email?: string; role?: "owner" | "admin" }
    | null;

  if (error || !admin?.user_id) {
    await supabase.auth.signOut();
    redirect("/admin/login?error=not-admin");
  }

  return {
    userId: admin.user_id!,
    email: admin.email ?? user.email ?? "",
    role: admin.role ?? "admin",
  };
}
