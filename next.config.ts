import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

const isDev = process.env.NODE_ENV === "development";

/**
 * This project's own Supabase origin. Images, data and auth come from there and
 * nowhere else — "*.supabase.co" would admit every Supabase project on the
 * internet, and the image optimiser would fetch from any of them under the
 * store's own domain. Before the keys are set there is no origin to pin.
 */
const supabaseOrigin = (() => {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
})();
const supabaseSource = supabaseOrigin ?? "https://*.supabase.co";

/**
 * Content Security Policy.
 *
 * 'unsafe-inline' on script-src is required because Next injects inline
 * bootstrap scripts and the pages emit inline JSON-LD; a nonce would force
 * every page to render per request, and the storefront is static. style-src
 * likewise, because Tailwind v4 and next/font both write inline style.
 * 'unsafe-eval' is for the dev server's hot reloading only — production never
 * evaluates strings. Fonts are self-hosted by next/font, so no font CDN.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  `img-src 'self' data: blob: ${supabaseSource}`,
  "media-src 'self'",
  // Supabase for data and auth (no realtime); Resend is called server-side only.
  `connect-src 'self' ${supabaseSource}`,
  // Card checkout is a form POST to PayHere's hosted payment page — see
  // src/lib/payhere/redirect.ts. Without these two hosts the browser drops it.
  "form-action 'self' https://www.payhere.lk https://sandbox.payhere.lk",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Clickjacking. frame-ancestors above covers modern browsers; this covers the rest.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The store needs none of these. Denying them shrinks the attack surface.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  // Two years, subdomains included. Only meaningful over HTTPS, which franley.lk is.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // No other site's window keeps a handle on ours (PayHere is a full-page
  // form POST, never a popup, so nothing here needs one).
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // The Browser pane reaches the dev server over 127.0.0.1 as well as localhost.
  allowedDevOrigins: ["127.0.0.1", "localhost"],

  poweredByHeader: false,
  compress: true,
  // A trailing-slash mismatch is a duplicate-content bug; be explicit.
  trailingSlash: false,

  images: {
    // AVIF first — roughly 20% smaller than WebP at the same quality, and the
    // catalogue is 93 photographs.
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      // Product and CMS media uploaded through the admin — this project's bucket only.
      {
        protocol: "https",
        hostname: supabaseOrigin ? new URL(supabaseOrigin).hostname : "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
    // Product shots are served at most at 1200px; no need to generate more.
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },

  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Files in public/ keep their names from one deploy to the next, so a
        // replaced photo must not be stuck in browsers for a year: a week,
        // then revalidate. (Next's own /_next/static files are content-hashed
        // and get "immutable" from Next itself, which this cannot override.)
        source: "/:all*(webp|avif|jpg|jpeg|png|svg|ico|mp4|woff2)",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
      {
        // Nothing under the admin should ever be cached or indexed.
        source: "/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        source: "/order/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, must-revalidate" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },

  async redirects() {
    return [
      // The Shopify store's URL shapes, so existing links and any indexed
      // pages land somewhere real instead of a 404.
      { source: "/collections/necktie", destination: "/collections/neckties", permanent: true },
      { source: "/collections/all", destination: "/shop", permanent: true },
      { source: "/pages/about-us", destination: "/about", permanent: true },
      { source: "/pages/contact", destination: "/contact", permanent: true },
      { source: "/pages/sizing-chart", destination: "/tie-guide", permanent: true },
      { source: "/policies/shipping-policy", destination: "/shipping", permanent: true },
      { source: "/policies/refund-policy", destination: "/returns", permanent: true },
      { source: "/policies/privacy-policy", destination: "/privacy", permanent: true },
      { source: "/policies/terms-of-service", destination: "/terms", permanent: true },
      { source: "/policies/contact-information", destination: "/contact", permanent: true },
      // Shopify's product-inside-collection links — the shape most old shares use.
      { source: "/collections/:collection/products/:handle", destination: "/products/:handle", permanent: true },
      // Listed twice on Shopify; the catalogue kept "4" (scripts/build-seed.mjs drops duplicate photos).
      { source: "/products/0004", destination: "/products/4", permanent: true },
      { source: "/collections/frontpage", destination: "/", permanent: true },
      // Shopify's search page. The query string (?q=…) carries over to the shop's own search.
      { source: "/search", destination: "/shop", permanent: true },
      // One canonical host. www.franley.lk only ever redirects here.
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.franley.lk" }],
        destination: "https://franley.lk/:path*",
        permanent: true,
      },
    ];
  },
};

/**
 * NEXT_PUBLIC_SITE_URL is inlined at BUILD time: every canonical URL, the
 * sitemap, the JSON-LD and the return/notify addresses sent to PayHere are
 * built from it. A production deploy built with localhost (the value in
 * .env.local) would ship all of those pointing at nobody's machine, so it is
 * refused outright on Vercel's production builds and flagged everywhere else.
 */
export default function config(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD) {
    const url = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
    const publicHttps = /^https:\/\/[^/]+$/.test(url) && !/localhost|127\.0\.0\.1/.test(url);
    if (!publicHttps) {
      const message = `NEXT_PUBLIC_SITE_URL is "${url || "unset"}". Production must be built with the live address, e.g. https://franley.lk.`;
      if (process.env.VERCEL_ENV === "production") throw new Error(message);
      console.warn(`\n⚠  ${message} Fine for a local test build; never deploy this build.\n`);
    }
  }
  return nextConfig;
}
