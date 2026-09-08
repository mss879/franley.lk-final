import type { Metadata } from "next";
import { PageHeader } from "@/components/site/page-header";
import { CartTable } from "@/components/shop/cart-table";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Your Bag",
  description: "The pieces you have chosen, ready for checkout.",
  canonical: "/cart",
  noindex: true,
});

export default function CartPage() {
  return (
    <>
      <PageHeader eyebrow="Checkout" title="Your Bag" />
      <div className="mx-auto max-w-[1400px] px-5 py-12 md:px-10 md:py-16">
        <CartTable />
      </div>
    </>
  );
}
