import type { Metadata } from "next";
import { PageHeader } from "@/components/site/page-header";
import { CheckoutForm } from "@/components/shop/checkout-form";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Checkout",
  description: "Confirm your delivery details and place your Franley order.",
  canonical: "/checkout",
  noindex: true,
});

export default function CheckoutPage() {
  return (
    <>
      <PageHeader eyebrow="Almost there" title="Checkout" />
      <div className="mx-auto max-w-[1400px] px-5 py-12 md:px-10 md:py-16">
        <CheckoutForm />
      </div>
    </>
  );
}
