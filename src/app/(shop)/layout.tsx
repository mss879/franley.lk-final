import { Header } from "@/components/site/header";
import { AnnouncementBar } from "@/components/site/announcement-bar";
import { getAnnouncement } from "@/lib/cms";
import { Footer } from "@/components/site/footer";
import { BagDrawer } from "@/components/shop/bag-drawer";
import { WhatsAppFloat } from "@/components/site/whatsapp-float";
import { CartProvider } from "@/lib/cart/cart-context";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const announcement = await getAnnouncement();

  return (
    <CartProvider>
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
  );
}
