import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import { SITE } from "@/lib/constants";
import { reportEnv } from "@/lib/env";
import { HTML_LANG, JsonLd, OG_FALLBACK, OG_LOCALE, SITE_ORIGIN, siteJsonLd } from "@/lib/seo";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  // No canonical here: `alternates` is inherited, and a root-level one would
  // point every page that forgot to set its own at the home page.
  openGraph: {
    type: "website",
    url: SITE_ORIGIN,
    siteName: SITE.name,
    locale: OG_LOCALE,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    images: [OG_FALLBACK],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    images: [OG_FALLBACK],
  },
  // /favicon.ico is not in the build; Google renders the favicon beside the
  // SERP result, so these point at the icons that are actually there.
  icons: {
    icon: [
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: { url: "/icon-180.png", sizes: "180x180", type: "image/png" },
  },
};

reportEnv();

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // The font variables must live on the element `@theme` targets (:root =
    // <html>). Tailwind emits `--font-display: var(--font-playfair), ...` on
    // :root, and a custom property is substituted on the element that DECLARES
    // it — so with the variables only on <body> both font tokens resolved to
    // the guaranteed-invalid value and every heading fell back to the UA sans.
    <html lang={HTML_LANG} className={`${playfair.variable} ${inter.variable}`}>
      <body className="antialiased">
        <JsonLd data={siteJsonLd()} />
        {children}
      </body>
    </html>
  );
}
