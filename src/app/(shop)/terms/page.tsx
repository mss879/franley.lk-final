import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/site/page-header";
import { Prose } from "@/components/site/prose";
import { SITE } from "@/lib/constants";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Terms & Conditions",
  description: "The terms that apply when you shop with Franley.",
  canonical: "/terms",
});

export default function TermsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Policies"
        title="Terms & Conditions"
        lede="By using Franley.lk, you agree to the following terms."
      />
      <div className="mx-auto max-w-[1400px] px-5 py-14 md:px-10 md:py-20">
        <Prose>
          <h2>Orders</h2>
          <ul>
            <li>All orders are subject to availability and confirmation.</li>
            <li>We may cancel orders due to stock issues, incorrect pricing, or suspected fraud.</li>
          </ul>

          <h2>Pricing</h2>
          <ul>
            <li>Prices are shown in LKR unless stated otherwise.</li>
            <li>We reserve the right to change prices at any time.</li>
          </ul>

          <h2>Delivery</h2>
          <ul>
            <li>Delivery timelines depend on your location and courier service.</li>
            <li>Delays caused by couriers, weather, or other external factors may occur.</li>
          </ul>
          <p>
            Full detail is in our <Link href="/shipping">Shipping Policy</Link>.
          </p>

          <h2>Returns &amp; refunds</h2>
          <p>
            Returns and refunds are handled according to our{" "}
            <Link href="/returns">Return &amp; Refund Policy</Link>.
          </p>

          <h2>Product information</h2>
          <p>
            We try to display product colours and details accurately, but slight
            variations may occur due to lighting and device screens.
          </p>

          <h2>Limitation of liability</h2>
          <p>
            Franley.lk is not liable for indirect or consequential damages
            arising from the use of our website or products, to the maximum
            extent permitted by law.
          </p>

          <h2>Contact</h2>
          <p>
            Email <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
            <br />
            Phone / WhatsApp:{" "}
            <a href={`https://wa.me/${SITE.whatsapp.replace(/\D/g, "")}`}>{SITE.phone}</a>
          </p>
        </Prose>
      </div>
    </>
  );
}
