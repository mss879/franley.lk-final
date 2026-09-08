import { DELIVERY, FLAT_SHIPPING_CENTS, SITE } from "@/lib/constants";
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

/**
 * The site-wide graph: who Franley is, where the search box goes, and the
 * Dehiwala shop itself. Emitted once from the root layout, so every page's
 * Product and Breadcrumb nodes can point at `#organization` and resolve.
 */
export function siteJsonLd() {
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
        email: SITE.email,
        telephone: SITE.phone,
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
          telephone: SITE.phone,
          email: SITE.email,
          areaServed: "LK",
          availableLanguage: "English",
        },
        // No verified brand profiles yet. An empty array says so; invented ones would not.
        sameAs: [],
      },
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        url: SITE_ORIGIN,
        name: SITE.name,
        description: SITE.description,
        inLanguage: HTML_LANG,
        publisher: { "@id": ORG_ID },
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
        telephone: SITE.phone,
        email: SITE.email,
        address: POSTAL_ADDRESS,
        areaServed: { "@type": "Country", name: SITE.address.country },
        currenciesAccepted: SITE.currency,
        paymentAccepted: "Cash on delivery, Bank transfer",
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
      itemListOrder: "https://schema.org/ItemListOrderAscending",
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
 * Shipping is stated as the rate this offer actually attracts. Free delivery
 * starts at Rs 5,000 and no single piece reaches Rs 1,790, so the flat rate is
 * the honest figure here — advertising the free tier per-offer would let Google
 * surface "free delivery" on a Rs 1,190 tie.
 */
const SHIPPING_DETAILS = {
  "@type": "OfferShippingDetails",
  shippingDestination: { "@type": "DefinedRegion", addressCountry: "LK" },
  shippingRate: {
    "@type": "MonetaryAmount",
    value: schemaPrice(FLAT_SHIPPING_CENTS),
    currency: SITE.currency,
  },
  deliveryTime: {
    "@type": "ShippingDeliveryTime",
    handlingTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 2, unitCode: "DAY" },
    transitTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 5, unitCode: "DAY" },
  },
} as const;

export function productJsonLd(product: Product, path: string) {
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
      shippingDetails: SHIPPING_DETAILS,
    },
  };
}
