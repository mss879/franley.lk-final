import type { NextConfig } from "next";

/**
 * Content Security Policy.
 *
 * 'unsafe-inline' on script-src is required because Next injects inline
 * bootstrap scripts and the pages emit inline JSON-LD; a nonce-based policy
 * would need every one of those threaded through, and Next does not currently
 * nonce its own hydration payload. style-src likewise, because Tailwind v4 and
 * next/font both write inline style. Everything else is locked down.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://*.supabase.co",
  "media-src 'self'",
  // Supabase for data and auth; Resend is called server-side only.
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "form-action 'self'",
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
      // Product and CMS media uploaded through the admin.
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
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
        // Content-hashed filenames, so these can be cached indefinitely.
        source: "/:all*(webp|avif|jpg|jpeg|png|svg|mp4|woff2)",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
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
    ];
  },
};

export default nextConfig;
