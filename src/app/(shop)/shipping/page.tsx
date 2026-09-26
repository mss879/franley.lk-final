import type { Metadata } from "next";
import { PageHeader } from "@/components/site/page-header";
import { Prose } from "@/components/site/prose";
import { DELIVERY } from "@/lib/constants";
import { getSiteSettings } from "@/lib/settings";
import { waLink } from "@/lib/settings/shipping";
import { formatPrice } from "@/lib/utils";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Shipping & Delivery",
  description: "How Franley orders are processed, dispatched and delivered across Sri Lanka.",
  canonical: "/shipping",
});

export default async function ShippingPage() {
  const s = await getSiteSettings();
  return (
    <>
      <PageHeader
        eyebrow="Policies"
        title="Shipping & Delivery"
        lede="Where we deliver, how long it takes, and what happens if something is delayed."
      />
      <div className="mx-auto max-w-[1400px] px-5 py-14 md:px-10 md:py-20">
        <Prose>
          <h2>Order processing</h2>
          <ul>
            <li>Orders are processed within {DELIVERY.processing}.</li>
            <li>Orders placed on weekends or public holidays are processed on the next business day.</li>
          </ul>

          <h2>Delivery areas</h2>
          <ul>
            <li>We deliver island-wide within Sri Lanka.</li>
            <li>We do not currently offer international shipping.</li>
          </ul>

          <h2>Delivery time</h2>
          <ul>
            <li><strong>Colombo &amp; suburbs:</strong> {DELIVERY.colombo}</li>
            <li><strong>Other areas:</strong> {DELIVERY.outstation}</li>
          </ul>
          <p>
            Delivery times may vary depending on the courier service and your
            location.
          </p>

          <h2>Shipping charges</h2>
          <ul>
            <li>Delivery is free on orders over {formatPrice(s.freeThresholdCents)}.</li>
            <li>Below that, a flat delivery charge is shown clearly at checkout before you pay.</li>
            <li>Any promotional free-delivery offer is stated on the product or checkout page.</li>
          </ul>

          <h2>Delivery partners</h2>
          <p>
            We use established third-party courier services to keep delivery safe
            and on schedule.
          </p>

          <h2>Order tracking</h2>
          <p>
            Tracking details are shared once your order is dispatched, where the
            courier provides them. You can also message us on WhatsApp with your
            order number at any point and we will check for you.
          </p>

          <h2>Delays</h2>
          <p>
            Franley is not responsible for delays caused by courier partners,
            weather, or other circumstances outside our control — but we will
            help you track the order and chase it where we can.
          </p>

          <h2>Shipping questions</h2>
          <p>
            Email <a href={`mailto:${s.email}`}>{s.email}</a> or message{" "}
            <a href={waLink(s.whatsapp)}>{s.phone}</a> on WhatsApp.
          </p>
        </Prose>
      </div>
    </>
  );
}
