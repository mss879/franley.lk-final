import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/lib/supabase/admin-guard";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Franley Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="flex min-h-dvh flex-col bg-cream-50 lg:flex-row">
      <AdminNav email={admin.email} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
