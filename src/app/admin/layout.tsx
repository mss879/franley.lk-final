import type { Metadata } from "next";

/**
 * The admin installs as its own Home Screen app, separate from the shop: its
 * manifest opens /admin full-screen ("standalone"), where the storefront's
 * stays in the browser (src/app/manifest.ts says why). On an iPhone that is
 * not cosmetic — iOS gives push notifications, and so new-order alerts, only
 * to a web app opened from the Home Screen. The file sits outside /admin
 * because the proxy sends signed-out /admin requests to the login page.
 */
export const metadata: Metadata = {
  manifest: "/franley-admin.webmanifest",
  appleWebApp: { capable: true, title: "Franley Admin", statusBarStyle: "default" },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
