import { AGENCY, DELIVERY, FLAT_SHIPPING_CENTS, FREE_SHIPPING_THRESHOLD_CENTS, SITE } from "@/lib/constants";
import { shippingFor } from "@/lib/settings/shipping";
import type { Product } from "@/types/domain";
import { HTML_LANG, OG_FALLBACK, SITE_ORIGIN, absoluteUrl, schemaPrice } from "./config";

const ORG_ID = `${SITE_ORIGIN}/#organization`;
const WEBSITE_ID = `${SITE_ORIGIN}/#website`;
const STORE_ID = `${SITE_ORIGIN}/#store`;
const LOGO_ID = `${SITE_ORIGIN}/#logo`;

const POSTAL_ADDRESS = {
  "@type": "PostalAddress",
  streetAddress: SITE.address.line1,
  addressLocality: SITE.address.city,
  addressCountry: "LK",
} as const;

export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // `<` is escaped so a stray "</script>" inside catalogue copy cannot close the tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

export type SiteGraphOptions = {
  /** From /admin/settings, so the graph never contradicts the footer. */
  phone?: string;
  email?: string;
  instagram?: string | null;
  facebook?: string | null;
  /** PayHere is configured, so cards are taken at checkout. */
  cardPayments?: boolean;
};

/**
 * The site-wide graph: who Franley is, where the search box goes, and the
 * Dehiwala shop itself. Emitted once from the storefront layout, so every
 * page's Product and Breadcrumb nodes can point at `#organization` and resolve.
 */
export function siteJsonLd(options: SiteGraphOptions = {}) {
  const phone = options.phone || SITE.phone;
  const email = options.email || SITE.email;
  // Only the profiles the owner has entered in Settings. Invented ones would not be verified.
  const sameAs = [options.instagram, options.facebook].filter(
    (url): url is string => typeof url === "string" && url.startsWith("https://"),
  );
  const paymentAccepted = [
    "Cash on delivery",
    "Bank transfer",
    ...(options.cardPayments ? ["Credit card", "Debit card"] : []),
  ].join(", ");

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORG_ID,
        name: SITE.name,
        url: SITE_ORIGIN,
        description: SITE.description,
        slogan: SITE.tagline,
        email,
        telephone: phone,
        address: POSTAL_ADDRESS,
        logo: {
          "@type": "ImageObject",
          "@id": LOGO_ID,
          url: absoluteUrl("/brand/logo-dark.png"),
          contentUrl: absoluteUrl("/brand/logo-dark.png"),
          caption: SITE.name,
        },
        image: { "@id": LOGO_ID },
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          telephone: phone,
          email,
          areaServed: "LK",
          availableLanguage: "English",
        },
        ...(sameAs.length ? { sameAs } : {}),
      },
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        url: SITE_ORIGIN,
        name: SITE.name,
        description: SITE.description,
        inLanguage: HTML_LANG,
        publisher: { "@id": ORG_ID },
        // Franley publishes the site; the studio that built it is its creator.
        creator: { "@type": "Organization", name: AGENCY.name, url: AGENCY.url },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${SITE_ORIGIN}/shop?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "Store",
        "@id": STORE_ID,
        name: SITE.name,
        url: SITE_ORIGIN,
        image: absoluteUrl(OG_FALLBACK),
        description: SITE.description,
        telephone: phone,
        email,
        address: POSTAL_ADDRESS,
        areaServed: { "@type": "Country", name: SITE.address.country },
        currenciesAccepted: SITE.currency,
        paymentAccepted,
        priceRange: "Rs 1,190 – Rs 1,790",
        openingHoursSpecification: [
          {
            "@type": "OpeningHoursSpecification",
            dayOfWeek: [
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
            ],
            opens: "09:00",
            closes: "18:00",
          },
        ],
        parentOrganization: { "@id": ORG_ID },
      },
    ],
  };
}

export type Crumb = { name: string; path: string };

export function breadcrumbJsonLd(crumbs: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

export function collectionJsonLd({
  name,
  description,
  path,
  products,
}: {
  name: string;
  description?: string | null;
  path: string;
  products: Pick<Product, "slug" | "title">[];
}) {
  const url = absoluteUrl(path);
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": url,
    url,
    name,
    ...(description ? { description } : {}),
    inLanguage: HTML_LANG,
    isPartOf: { "@id": WEBSITE_ID },
    mainEntity: {
      "@type": "ItemList",
      name,
      numberOfItems: products.length,
      // Curated or newest-first — neither is an ascending order of anything.
      itemListOrder: "https://schema.org/ItemListUnordered",
      itemListElement: products.map((product, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: product.title,
        url: absoluteUrl(`/products/${product.slug}`),
      })),
    },
  };
}

/**
 * Return terms come straight from /returns: 7 days, and the customer covers
 * return postage unless we shipped the wrong or a defective item.
 */
const RETURN_POLICY = {
  "@type": "MerchantReturnPolicy",
  applicableCountry: "LK",
  returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
  merchantReturnDays: DELIVERY.returnsWindow,
  returnMethod: "https://schema.org/ReturnByMail",
  returnFees: "https://schema.org/ReturnFeesCustomerResponsibility",
  merchantReturnLink: absoluteUrl("/returns"),
} as const;

/**
 * Shipping is stated as the rate this offer actually attracts: what one of
 * this piece, bought on its own, is charged under the delivery rule in
 * /admin/settings. Advertising the free tier per-offer would let Google
 * surface "free delivery" on a piece that does not qualify for it alone.
 */
function shippingDetails(priceCents: number, rule: { flatRateCents: number; freeThresholdCents: number }) {
  return {
    "@type": "OfferShippingDetails",
    shippingDestination: { "@type": "DefinedRegion", addressCountry: "LK" },
    shippingRate: {
      "@type": "MonetaryAmount",
      value: schemaPrice(shippingFor(priceCents, rule)),
      currency: SITE.currency,
    },
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      handlingTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 2, unitCode: "DAY" },
      transitTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 5, unitCode: "DAY" },
    },
  } as const;
}

export function productJsonLd(
  product: Product,
  path: string,
  rule: { flatRateCents: number; freeThresholdCents: number } = {
    flatRateCents: FLAT_SHIPPING_CENTS,
    freeThresholdCents: FREE_SHIPPING_THRESHOLD_CENTS,
  },
) {
  const url = absoluteUrl(path);
  const images = (product.images.length ? product.images : [OG_FALLBACK]).map(absoluteUrl);
  const width = product.widthCm ? Number(product.widthCm) : null;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: product.title,
    description: product.description,
    url,
    image: images,
    sku: product.slug,
    brand: { "@type": "Brand", name: SITE.name },
    ...(product.categoryName ? { category: product.categoryName } : {}),
    ...(product.colorName ? { color: product.colorName } : {}),
    ...(width && Number.isFinite(width)
      ? { width: { "@type": "QuantitativeValue", value: width, unitCode: "CMT" } }
      : {}),
    offers: {
      "@type": "Offer",
      url,
      price: schemaPrice(product.priceCents),
      priceCurrency: SITE.currency,
      // Prices are reviewed annually; a date in the past is treated as stale.
      priceValidUntil: `${new Date().getFullYear() + 1}-12-31`,
      availability:
        product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", "@id": ORG_ID, name: SITE.name },
      hasMerchantReturnPolicy: RETURN_POLICY,
      shippingDetails: shippingDetails(product.priceCents, rule),
    },
  };
}
