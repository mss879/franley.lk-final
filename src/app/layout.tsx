import type { Metadata, Viewport } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import { SITE } from "@/lib/constants";
import { reportEnv } from "@/lib/env";
import { HTML_LANG, OG_FALLBACK_IMAGE, OG_LOCALE, SITE_ORIGIN } from "@/lib/seo";
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
    default: SITE.seoTitle,
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
    title: SITE.seoTitle,
    description: SITE.description,
    images: [OG_FALLBACK_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.seoTitle,
    description: SITE.description,
    images: [OG_FALLBACK_IMAGE],
  },
  // Icons come from the file conventions beside this layout — favicon.ico
  // (16/32/48), icon.png (512) and apple-icon.png (180) — and the manifest
  // from manifest.ts. Setting `icons` here would switch those files off.
};

/** The maroon the browser paints its own chrome in on mobile. */
export const viewport: Viewport = {
  themeColor: "#711625",
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
        {children}
      </body>
    </html>
  );
}
