import Link from "next/link";
import { ReceiptText, Package, FolderTree, ImageIcon, AlertTriangle, ExternalLink, Users, Layers, Settings } from "lucide-react";
import { AdminPageShell } from "@/components/admin/page-shell";
import { requireAdmin } from "@/lib/supabase/admin-guard";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils";
import { colomboMonthStartISO } from "@/components/admin/orders/format";

export const dynamic = "force-dynamic";

const SHORTCUTS = [
  { href: "/admin/orders", label: "Orders", body: "Fulfil, track and update customer orders.", Icon: ReceiptText },
  { href: "/admin/customers", label: "Customers", body: "Everyone who has ordered, with their contact details.", Icon: Users },
  { href: "/admin/products", label: "Products", body: "Add pieces, set prices and manage stock.", Icon: Package },
  { href: "/admin/categories", label: "Categories", body: "The structure of the range: ties, stripes, cufflinks.", Icon: FolderTree },
  { href: "/admin/collections", label: "Collections", body: "Curated edits you pick by hand — gifts, featured.", Icon: Layers },
  { href: "/admin/content", label: "Content & Banners", body: "Change the homepage copy and imagery.", Icon: ImageIcon },
  { href: "/admin/settings", label: "Settings", body: "Contact details, delivery charges, bank details.", Icon: Settings },
];

async function loadStats() {
  const supabase = await createClient();

  // Every count is done in the database with head:true. Pulling the rows and
  // counting them in JS looks equivalent but is not: PostgREST caps an
  // unbounded select at 1000 rows, so past a thousand orders the dashboard
  // would quietly start under-reporting instead of failing.
  //
  // The month boundary comes from colomboMonthStartISO rather than the server
  // clock — on a UTC host, "this month" would otherwise be wrong for the first
  // five and a half hours of the 1st.
  const monthStart = colomboMonthStartISO();
  const LIVE_STATUSES = ["pending", "confirmed", "packed", "shipped", "delivered"];

  const [revenueRows, allOrders, pending, products, lowStock] = await Promise.all([
    // Only this month's live orders are summed, so the row set stays small
    // regardless of how long the shop has been trading.
    supabase
      .from("orders")
      .select("total_cents")
      .gte("created_at", monthStart)
      .in("status", LIVE_STATUSES)
      .limit(5000),
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "active"),
    // Low stock is bounded by the catalogue, which is small, and the comparison
    // is against a per-product column so it cannot be pushed into the query.
    supabase.from("products").select("id, title, stock, low_stock_threshold").eq("status", "active").limit(1000),
  ]);

  const revenue = ((revenueRows.data ?? []) as { total_cents: number }[])
    .reduce((n, o) => n + o.total_cents, 0);

  const low = ((lowStock.data ?? []) as { id: string; title: string; stock: number; low_stock_threshold: number }[])
    .filter((p) => p.stock <= p.low_stock_threshold)
    .sort((a, b) => a.stock - b.stock);

  return {
    totalOrders: allOrders.count ?? 0,
    pending: pending.count ?? 0,
    products: products.count ?? 0,
    revenue,
    low,
  };
}

export default async function AdminDashboard() {
  const admin = await requireAdmin();

  let stats: Awaited<ReturnType<typeof loadStats>> | null = null;
  let statsError = false;
  try {
    stats = await loadStats();
  } catch {
    statsError = true;
  }

  return (
    <AdminPageShell
      title={`Good to see you`}
      description={`Signed in as ${admin.email}. Here is where the store stands.`}
    >
      {statsError ? (
        <div className="rounded-2xl border border-cream-300 bg-cream-100 p-6 text-sm text-ink-600">
          Could not load store figures. Check that the migrations in{" "}
          <code className="rounded bg-cream-200 px-1.5 py-0.5 text-xs">supabase/migrations</code> have
          been applied to your project.
        </div>
      ) : (
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Revenue this month", value: formatPrice(stats!.revenue) },
            { label: "Orders, all time", value: String(stats!.totalOrders) },
            { label: "Awaiting action", value: String(stats!.pending) },
            { label: "Active products", value: String(stats!.products) },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-cream-300 bg-cream-100 p-6">
              <dt className="eyebrow text-ink-600">{s.label}</dt>
              <dd className="font-display mt-2 text-3xl tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {stats && stats.low.length > 0 && (
        <div className="mt-8 rounded-2xl border border-wine-700/25 bg-wine-700/5 p-6">
          <div className="flex items-center gap-2 text-wine-800">
            <AlertTriangle className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            <h2 className="font-display text-lg">Running low</h2>
          </div>
          <ul className="mt-4 flex flex-wrap gap-2">
            {stats.low.slice(0, 10).map((p) => (
              <li key={p.id}>
                <Link
                  href={`/admin/products/${p.id}/edit`}
                  className="inline-flex items-center gap-2 rounded-full border border-wine-700/25 bg-cream-50 px-4 py-2 text-xs transition-colors hover:border-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
                >
                  {p.title}
                  <span className="tabular-nums text-wine-700">{p.stock} left</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {SHORTCUTS.map(({ href, label, body, Icon }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-2xl border border-cream-300 bg-cream-100 p-6 transition-colors hover:border-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
          >
            <Icon className="h-5 w-5 text-wine-700" strokeWidth={1.5} aria-hidden />
            <h2 className="font-display mt-4 text-xl transition-colors group-hover:text-wine-700">{label}</h2>
            <p className="mt-1.5 text-sm text-ink-600">{body}</p>
          </Link>
        ))}
      </div>

      <Link
        href="/"
        target="_blank"
        className="mt-8 inline-flex items-center gap-2 text-sm text-ink-600 underline underline-offset-4 transition-colors hover:text-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
      >
        <ExternalLink className="h-4 w-4" strokeWidth={1.5} aria-hidden />
        Open the storefront
      </Link>
    </AdminPageShell>
  );
}
