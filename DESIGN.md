# FRANLEY — Design Language

Derived from three reference boards supplied by the client, plus the official
Franley logo. Every agent building UI must follow this document.

## 1. The feeling

Old-world tailoring house, rendered digitally. Warm cream, deep ink, champagne
gold — with the brand maroon held back as an accent. High-contrast serif display
type against small, wide-tracked sans-serif labels. Generous negative space.
Nothing bouncy, nothing playful, no purple-blue SaaS gradients, no emoji, no
drop shadows with colour.

The reference boards below are burgundy-led. The client asked for far less
maroon, so the boards now govern **layout and type only**; colour follows §2.

Reference anchors:
- **Board 1 (tailoring landing page)** — a full-bleed deep burgundy canvas.
  Huge thin-to-bold serif headline ("Individual Men's Tailoring") set left,
  breaking across two lines. Product hero sits inside a *rounded rectangle
  panel* one shade lighter than the page. A circular badge with text running
  around its circumference ("EXPLORE MORE • EXPLORE MORE •") and an arrow
  glyph in a white centre disc, overlapping the panel's lower-left corner.
  Small cream cards float over the burgundy holding a secondary product shot
  plus a short heading and a text link with a rule beneath it. Pill-shaped
  outline input with a solid cream pill button nested at its right edge.
- **Board 2 (WIZWID capsule collection)** — champagne-gold serif display over
  a burgundy vignette. Wide letter-spaced small caps subtitles
  ("C A P S U L E   C O L L E C T I O N"). Alternating dark bands. Editorial
  offset image pairs — one large image, one smaller image overlapping its
  corner. Centred price in italic serif under a product carousel with thin
  chevron arrows at the far left/right edges.
- **Board 3 (jewellery "OUR WORKs")** — near-black panel inset on a warm
  background. A row of tall rounded-corner cards, each **slightly rotated**
  and vertically offset in a fanned arc, the centre card upright, larger, and
  carrying a small pill-shaped category tag. Card captions overlay the image
  at its base. Circular outline prev/next buttons centred beneath.

## 2. Colour

Tokens live in `src/app/globals.css` under `@theme`. Use the Tailwind classes,
never raw hex in components.

| Role | Token | Hex |
|---|---|---|
| Page background | `cream-50` | `#FDFBF7` |
| Tinted band, page header | `cream-100` | `#F9F5EE` |
| Hairlines on cream | `cream-300` | `#E6DBCA` |
| Dark band, solid button | `ink-900` | `#171514` |
| Footer, photo scrims | `ink-950` | `#0E0D0C` |
| Body copy | `ink-800` | `#2B2825` |
| Muted copy | `ink-400`/`ink-600` | — |
| Accent on dark (eyebrows, rules) | `champagne-300/400` | `#DCC79B` / `#CBAE73` |
| Accent on cream (eyebrows, icons) | `champagne-700` | `#7A6030` |
| Brand maroon (from logo) | `wine-700` | `#711625` |

Rules:
- **Maroon is an accent, never a surface.** It appears as the hover state of
  buttons and links, the sale flag, and error messages — nowhere else. No
  maroon bands, panels, page headers or solid buttons.
- The site is light-first (cream page). Dark ink is used for *bands*, and
  sparingly: the home banner, one editorial band per page, the thin marquee
  ribbon, the footer, the admin sidebar. Never stack two dark bands.
- On ink: text is `cream-100`; secondary text `cream-100/70`; hairlines
  `cream-100/15`. Accent text is `champagne-300`.
- On cream: headings `ink-900`, accents `champagne-700` (the lighter
  champagnes fail contrast as text on cream).
- Scrims over photographs are neutral (`ink-950`), never tinted, so the
  product keeps its own colour.
- **Product photography is shot on pure white.** Never place a product image
  directly on a dark band — it will show a white box. Product images always
  sit in a `cream-100`/white rounded container. This is non-negotiable.
- Do **not** implement a dark-mode toggle. One committed look.

## 2b. Imagery

Two sources, and they are used differently:

* **Product cut-outs** (`public/products/*.webp`) come from the live Shopify
  store. Shot on pure white, so they always sit in a white or cream frame with
  `object-contain` and padding. Never `object-cover`, never on a dark band.
* **Editorial photography** (`public/editorial/*.webp`) and the two ambient
  clips (`public/video/*.mp4`) are the client's own brand assets. Warm,
  low-key, gold-lit interiors. These are `object-cover` and fill their frame.

The clips are silent, looping, and mounted through `<VideoFrame>`, which holds
until the frame scrolls into view and shows the poster still instead of
autoplaying for anyone with `prefers-reduced-motion`. There is deliberately
**no hero video** — the client rejected it.

The home banner (`public/banners/hero-collection.webp`) is the client's
supplied photograph, and the client wants it shown as one whole image filling
the first screen: no slider, no slow zoom, no split panel. The copy sits at the
foot over the dark tabletop. On a window wider than the 3:2 photograph it is
drawn whole at full height with feathered sides rather than cropped to fill
the width. The two category cards (`public/editorial/category-*.webp`) were
generated to match it: same walnut tabletop, same warm low-key light.

The brand mark (`public/brand/mark.png`, the tie glyph) is the favicon source.
The full wordmark (`public/brand/logo-dark.png`) is black, and is inverted with
`brightness-0 invert` wherever it sits on a dark band.

## 3. Type

- Display: **Playfair Display** (`font-display`), weights 400–700. Used for
  page headings, product titles at size, prices in hero contexts, section
  headings. Tracking is tight (`-0.02em`, already in the class).
- UI/body: **Inter** (`font-sans`).
- Eyebrow labels: use the `.eyebrow` utility — 11px, `0.22em` tracking,
  uppercase, medium. Every major section gets one.
- Scale: hero `text-6xl`→`text-8xl`; section heading `text-4xl`→`text-5xl`;
  card title `text-lg`; body `text-sm`/`text-base`; label `text-xs`.
- Long headings break across lines deliberately; use `text-balance`.

## 4. Form

- Radii: cards and panels `rounded-[--radius-card]` (20px) or `rounded-3xl`.
  Buttons and inputs are **pills** (`rounded-full`). Product image frames
  `rounded-2xl`.
- Borders: 1px hairlines only. `border-cream-300` on light,
  `border-cream-100/15` on ink.
- Shadow: almost none. A card may use `shadow-[0_1px_2px_rgba(0,0,0,0.04)]`
  and lift to `shadow-[0_18px_40px_-24px_rgba(23,21,20,0.45)]` on hover.
  Never coloured glows.
- Motion: 300–500ms with `ease-[--ease-lux]`. Images scale to 1.03 on card
  hover behind `overflow-hidden`. Respect `prefers-reduced-motion` (the
  global CSS already handles the blanket case).

## 5. Signature components to reuse

These come straight from the boards — build them once, use them everywhere.

1. `<CircularBadge>` — text on a circular path (SVG `<textPath>`) rotating
   slowly, arrow glyph in a centre disc. Board 1's "EXPLORE MORE" badge.
2. `<FannedCards>` — the Board 3 arc: cards rotated `-6deg / -3deg / 0 / 3deg
   / 6deg` with matching vertical offsets, centre card scaled up. Collapses to
   a plain horizontal snap-scroll row under `md`.
3. `<Eyebrow>` — wide-tracked small caps label with an optional leading rule.
4. `<SectionHeading>` — eyebrow + display heading + optional lede, with a
   right-aligned "View all" text link carrying a bottom rule.
5. `<Marquee>` — the scrolling strip of brand promises (Premium Quality
   Materials · Islandwide Delivery · Secure Payments · WhatsApp Support),
   separated by a small diamond glyph.

## 6. Copy voice

Confident, spare, specific about make and material. "Woven in a fine twill."
Not "Shop our amazing ties!!". No exclamation marks. Sentence case in body,
title case in nav.

## 7. Accessibility (hard requirements)

- Every interactive element reachable by keyboard with a visible focus ring:
  `focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2`.
  The ring is `ink-900` on cream; a dark container adds `focus-on-dark` to
  flip it to `champagne-400` for everything inside.
- Cream on `ink-900` and `ink-800` on `cream-50` both clear AA. Never place
  `champagne-400` on cream as text — use `champagne-700`.
- All images need real `alt`. Decorative ones get `alt=""`.
- Carousels and fanned rows need real prev/next buttons, not drag-only.
