import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Nothing under these has any business in an index. Filtered and
      // searched listings stay crawlable so their canonical and noindex tags
      // can be read — blocking them here would hide those signals.
      disallow: ["/admin", "/admin/", "/checkout", "/cart", "/order/", "/api/"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
