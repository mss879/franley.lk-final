import type { Metadata } from "next";
import { PageHeader } from "@/components/site/page-header";
import { CheckoutForm } from "@/components/shop/checkout-form";
import { buildMetadata } from "@/lib/seo";
import { payhereEnabled } from "@/lib/payhere";
import { getSiteSettings } from "@/lib/settings";
import { ButtonLink } from "@/components/ui/button";
import { waLink } from "@/lib/settings/shipping";

export const metadata: Metadata = buildMetadata({
  title: "Checkout",
  description: "Confirm your delivery details and place your Franley order.",
  canonical: "/checkout",
  noindex: true,
});

// Whether card payment is offered depends on the PayHere keys, which are read
// at request time so adding them does not need a rebuild to take effect.
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const settings = await getSiteSettings();

  return (
    <>
      <PageHeader eyebrow="Almost there" title="Checkout" />
      <div className="mx-auto max-w-[1400px] px-5 py-12 md:px-10 md:py-16">
        {settings.checkoutEnabled ? (
          <CheckoutForm cardEnabled={payhereEnabled()} />
        ) : (
          // The "Accept orders" switch in /admin/settings. place_order refuses
          // too, so this is courtesy, not the guard.
          <div className="mx-auto max-w-xl rounded-3xl border border-cream-300 bg-cream-100 px-8 py-14 text-center">
            <p className="font-display text-3xl">Checkout is closed for now</p>
            <p className="mt-4 text-sm leading-relaxed text-ink-600">
              We are not taking online orders at the moment. Your bag is saved — message us on
              WhatsApp and we will help you order directly.
            </p>
            <ButtonLink href={waLink(settings.whatsapp)} size="lg" className="mt-7">
              Message us on WhatsApp
            </ButtonLink>
          </div>
        )}
      </div>
    </>
  );
}
