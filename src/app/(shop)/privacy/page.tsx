import type { Metadata } from "next";
import { PageHeader } from "@/components/site/page-header";
import { Prose } from "@/components/site/prose";
import { SITE } from "@/lib/constants";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Privacy Policy",
  description:
    "How Franley collects, uses and protects your personal information when you shop with us.",
  canonical: "/privacy",
});

export default function PrivacyPage() {
  return (
    <>
      <PageHeader
        eyebrow="Policies"
        title="Privacy Policy"
        lede="At Franley we respect your privacy and are committed to protecting your personal information."
      />
      <div className="mx-auto max-w-[1400px] px-5 py-14 md:px-10 md:py-20">
        <Prose>
          <h2>Information we collect</h2>
          <p>When you place an order or contact us, we may collect:</p>
          <ul>
            <li>Name, phone number and email address</li>
            <li>Billing and shipping address</li>
            <li>Order details and communication history</li>
          </ul>

          <h2>Payments</h2>
          <p>
            Orders are paid by cash on delivery or by bank transfer. We do not
            accept card payments online, and no card or banking credentials are
            ever collected, processed or stored by this website. If you choose
            bank transfer, we email you our account details after your order is
            placed, and you send the payment from your own bank.
          </p>

          <h2>How we use your information</h2>
          <ul>
            <li>To process orders and deliver products</li>
            <li>To provide customer support</li>
            <li>To send order updates and important service messages</li>
            <li>To improve our website and services</li>
            <li>For marketing, only if you choose to receive promotions</li>
          </ul>

          <h2>Sharing of information</h2>
          <p>
            We may share limited information with trusted service providers —
            our delivery partners and the service that sends our order emails —
            only as needed to complete your order. We do not use a payment
            processor, and we do not sell or rent customer data.
          </p>

          <h2>Cookies</h2>
          <p>
            Our website may use cookies to improve your browsing experience and
            for analytics.
          </p>

          <h2>Your rights</h2>
          <p>
            You may request access to, correction of, or deletion of your
            personal data by contacting us.
          </p>

          <h2>Contact us</h2>
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
