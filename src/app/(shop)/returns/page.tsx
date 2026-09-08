import type { Metadata } from "next";
import { PageHeader } from "@/components/site/page-header";
import { Prose } from "@/components/site/prose";
import { SITE, DELIVERY } from "@/lib/constants";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Returns & Refunds",
  description: "Franley's return, refund and exchange policy for orders delivered in Sri Lanka.",
  canonical: "/returns",
});

export default function ReturnsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Policies"
        title="Returns & Refunds"
        lede="If a piece is not right, we would rather fix it than have it sit in a drawer."
      />
      <div className="mx-auto max-w-[1400px] px-5 py-14 md:px-10 md:py-20">
        <Prose>
          <p>
            We value your satisfaction. If for any reason you are not completely
            happy with your purchase, here is exactly how it works.
          </p>

          <h2>Returns</h2>
          <ul>
            <li>We accept returns within <strong>{DELIVERY.returnsWindow} days</strong> of the delivery date.</li>
            <li>The item must be unused, in the same condition you received it, and in its original packaging.</li>
            <li>Proof of purchase — your order number or receipt — is required.</li>
          </ul>

          <h2>Refunds</h2>
          <ul>
            <li>Once we receive and inspect the item, we will tell you whether the refund is approved.</li>
            <li>Approved refunds are returned to your original payment method.</li>
            <li>Delivery charges are not refundable, unless the return is due to our error.</li>
          </ul>

          <h2>Exchanges</h2>
          <ul>
            <li>To exchange for a different size, colour or style, contact us within {DELIVERY.returnsWindow} days of receiving your order.</li>
            <li>Exchanges are subject to stock availability, so it is worth messaging early.</li>
          </ul>

          <h2>Damaged or wrong items</h2>
          <p>
            If your item arrives damaged or defective, or you received the wrong
            item, contact us within <strong>{DELIVERY.damageWindow} hours</strong> of
            delivery with photos. We will arrange a replacement or a refund
            depending on availability.
          </p>

          <h2>Return shipping</h2>
          <ul>
            <li>Return shipping is the customer&rsquo;s responsibility, unless the return is due to our error — a wrong or defective item.</li>
            <li>Please use a trackable courier service so neither of us is guessing.</li>
          </ul>

          <h2>Start a return</h2>
          <p>
            Email <a href={`mailto:${SITE.email}`}>{SITE.email}</a> or message{" "}
            <a href={`https://wa.me/${SITE.whatsapp.replace(/\D/g, "")}`}>{SITE.phoneLocal}</a> with
            your order number and a photo of the item.
          </p>
        </Prose>
      </div>
    </>
  );
}
