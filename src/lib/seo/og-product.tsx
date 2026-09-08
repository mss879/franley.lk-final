import { SITE } from "@/lib/constants";
import type { Product } from "@/types/domain";
import { schemaPrice } from "./config";

/**
 * Next's OpenGraph type union has no "product" variant, and `metadata.other`
 * would emit `name="og:type"` where the protocol wants `property`. React hoists
 * these into <head>, so the product namespace is rendered directly instead. The
 * page's `buildMetadata` call passes ogType "none" so nothing collides.
 */
export function ProductOpenGraph({ product }: { product: Product }) {
  return (
    <>
      <meta property="og:type" content="product" />
      <meta property="product:price:amount" content={schemaPrice(product.priceCents)} />
      <meta property="product:price:currency" content={SITE.currency} />
      <meta
        property="product:availability"
        content={product.stock > 0 ? "in stock" : "out of stock"}
      />
      <meta property="product:condition" content="new" />
      <meta property="product:retailer_item_id" content={product.slug} />
    </>
  );
}
