import type { HeroSlide } from "@/components/site/hero-slider";
import type { EditorialContent } from "@/components/site/editorial-band";
import type { ShowcaseContent } from "@/components/site/category-showcase";

/**
 * Fallback storefront content. The CMS overrides these per key; anything the
 * admin has not touched renders from here, so the site is never blank and a
 * bad CMS row can never take the homepage down.
 */
export type HomeContent = {
  heroSlides: HeroSlide[];
  showcase: ShowcaseContent;
  editorial: EditorialContent;
  marquee: string[];
  collection: { eyebrow: string; title: string; lede: string };
  lookbook: { eyebrow: string; title: string; lede: string };
};

export const DEFAULT_HOME: HomeContent = {
  heroSlides: [
    {
      image: "/banners/banner-ties.webp",
      imageAlt: "Silk neckties in burgundy, olive, black and gold laid across dark polished walnut",
      eyebrow: "The Art of Modern Man",
      title: "Woven silk, cut to a modern blade",
      lede: "Neckties chosen for how they hold a knot and how they fall. Delivered islandwide, usually within three days.",
      cta: { href: "/collections/neckties", label: "Shop Neckties" },
    },
    {
      image: "/banners/banner-cufflinks.webp",
      imageAlt: "Silver cufflinks and a matching tie clip in a burgundy presentation case",
      eyebrow: "Finishing details",
      title: "The small things people notice",
      lede: "Cufflinks and clips in premium metal alloy, gift boxed and ready to hand over.",
      cta: { href: "/collections/cufflinks", label: "Shop Cufflinks" },
    },
  ],
  showcase: {
    eyebrow: "Franley luxury",
    title: "Shop our categories",
    lede: "Browse our handcrafted collections, made for modern elegance and timeless style.",
    cards: [
      {
        href: "/collections/neckties",
        image: "/editorial/cat-neckties.webp",
        imageAlt: "A burgundy silk necktie rolled on a dark wooden surface",
        kicker: "Curated elegance",
        name: "Neckties",
        accent: "wine",
      },
      {
        href: "/collections/cufflinks",
        image: "/editorial/cat-cufflinks.webp",
        imageAlt: "Ornate gold cufflinks resting on dark navy cloth",
        kicker: "Bespoke details",
        name: "Cufflinks",
        accent: "champagne",
      },
    ],
  },
  editorial: {
    eyebrow: "The Franley standard",
    title: "The Art of Modern Man",
    subtitle: "Signature Collection",
    body:
      "Every Franley tie starts as a bolt of micro-textured fabric chosen for how it holds a knot. It is cut on the bias so the blade falls straight, backed with a soft interlining that gives without creasing, and closed with a hand slip stitch that lets the tie recover its shape overnight. The result is a piece that looks the same on its hundredth wearing as on its first.",
    cta: { href: "/about", label: "Read our story" },
    videoLarge: "/video/tie-adjust.mp4",
    videoLargePoster: "/video/tie-adjust-poster.webp",
    imageLarge: "/editorial/desk-ties.webp",
    imageLargeAlt: "A man fastening a burgundy silk tie at the collar",
    imageSmall: "/editorial/cuff-detail.webp",
    imageSmallAlt: "A silver cufflink with a burgundy inlay fastened through a white cuff",
  },
  marquee: [
    "Premium Quality Materials",
    "Islandwide Delivery",
    "Cash on Delivery",
    "Fast WhatsApp Support",
  ],
  collection: {
    eyebrow: "The Collection",
    title: "Pieces worth the knot",
    lede: "A tight, considered range — solids that go with everything and stripes that do the talking.",
  },
  lookbook: {
    eyebrow: "Just in",
    title: "New this season",
    lede: "The latest additions to the range — worth a look before they move.",
  },
};
