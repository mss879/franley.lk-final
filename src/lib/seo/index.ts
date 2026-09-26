export {
  CONTENT_REVISED,
  HTML_LANG,
  OG_FALLBACK,
  OG_FALLBACK_IMAGE,
  OG_LOCALE,
  SITE_ORIGIN,
  absoluteUrl,
} from "./config";
export {
  activeColors,
  buildMetadata,
  isSearch,
  listingCanonical,
  listingNoindex,
  type ListingParams,
  type PageSeo,
} from "./metadata";
export { productSeoDescription, productSeoTitle } from "./product-copy";
export { ProductOpenGraph } from "./og-product";
export {
  JsonLd,
  breadcrumbJsonLd,
  collectionJsonLd,
  productJsonLd,
  siteJsonLd,
  type Crumb,
  type SiteGraphOptions,
} from "./json-ld";
