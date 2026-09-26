import { Header } from "@/components/site/header";
import { AnnouncementBar } from "@/components/site/announcement-bar";
import { getAnnouncement } from "@/lib/cms";
import { Footer } from "@/components/site/footer";
import { BagDrawer } from "@/components/shop/bag-drawer";
import { WhatsAppFloat } from "@/components/site/whatsapp-float";
import { CartProvider } from "@/lib/cart/cart-context";
import { payhereEnabled } from "@/lib/payhere";
import { JsonLd, siteJsonLd } from "@/lib/seo";
import { getSiteSettings, publicSettings } from "@/lib/settings";
import { SiteSettingsProvider } from "@/lib/settings/provider";

/**
 * Pages that never set their own interval (about, policies, contact…) are
 * built once and refreshed at most every five minutes, so the announcement bar,
 * footer collections and contact details they carry catch up even if an admin
 * save's on-demand revalidation is ever missed. Pages with a shorter interval
 * (products and listings: 60s) keep theirs — the lowest value wins.
 */
export const revalidate = 300;

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [announcement, settings] = await Promise.all([getAnnouncement(), getSiteSettings()]);

  return (
    <SiteSettingsProvider value={publicSettings(settings)}>
    <CartProvider>
      <JsonLd
        data={siteJsonLd({
          phone: settings.phone,
          email: settings.email,
          instagram: settings.instagram,
          facebook: settings.facebook,
          cardPayments: payhereEnabled(),
        })}
      />
      <div className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-wine-700 focus:px-5 focus:py-3 focus:text-sm focus:text-cream-50"
        >
          Skip to content
        </a>
        <AnnouncementBar content={announcement} />
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
        <BagDrawer />
        <WhatsAppFloat />
      </div>
    </CartProvider>
    </SiteSettingsProvider>
  );
}
