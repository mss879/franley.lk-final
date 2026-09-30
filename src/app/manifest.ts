import type { MetadataRoute } from "next";
import { SITE } from "@/lib/constants";

/**
 * Name, colours and icons for "Add to Home Screen". display is "browser", not
 * "standalone": this is a shop, and a chrome-less window has no back button or
 * address bar for the PayHere round trip or for sharing a product link.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.seoTitle,
    short_name: SITE.name,
    description: SITE.description,
    start_url: "/",
    scope: "/",
    display: "browser",
    background_color: "#FDFBF7",
    theme_color: "#171514",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Full-bleed maroon with the mark well inside the central safe zone, so
      // Android's circle and squircle crops never cut into it.
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
