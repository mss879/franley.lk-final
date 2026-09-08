# Franley — franley.lk

A rebuild of the Franley storefront on **Next.js 16** (App Router, React 19,
Turbopack) + **Tailwind CSS v4** + **Supabase**, with a full admin panel and a
CMS the shop owner can use without touching code.

---

## Quick start

```bash
npm install
cp .env.example .env.local     # then fill in your Supabase keys
npm run dev
```

The storefront runs **without Supabase configured** — it falls back to the
bundled catalogue in `data/seed.json`, so you can see the whole site
immediately. `/admin` stays locked until the keys are in place.

To go live, follow **[DEPLOY.md](DEPLOY.md)** — the full launch checklist,
including Supabase, Resend and DNS. **[supabase/README.md](supabase/README.md)**
covers the database on its own, written for a non-developer.

---

## What's here

### Storefront
| Route | Purpose |
|---|---|
| `/` | Home — hero, collection, editorial band, new arrivals, categories |
| `/shop` | All products, with colour filters and sorting |
| `/collections/[slug]` | A category (child categories roll up into the parent) |
| `/products/[slug]` | Product detail, gallery, add to bag, related pieces |
| `/cart`, `/checkout` | Bag and guest checkout |
| `/order/[number]` | Order confirmation & tracking, opened by a private token |
| `/about`, `/contact` | Brand and support |
| `/tie-guide`, `/care` | Knot guide and fabric care |
| `/shipping`, `/returns`, `/privacy`, `/terms` | Policies |

### Admin (`/admin`)
Sign in at `/admin/login` with the account you create in Supabase.
There is **no sign-up page** — admins are granted by hand, on purpose.

- **Orders** — list, filter, detail, status transitions, tracking, cancellation
- **Products** — full CRUD, image upload and ordering, stock, low-stock alerts
- **Categories** — nested tree, ordering, images
- **Content & Banners** — the CMS: labelled fields per storefront block, banner
  scheduling, and a media library

---

## Architecture notes

**Money is integer cents, everywhere.** `price_cents`, `total_cents`, and so on.
Render with `formatPrice()` from `src/lib/utils.ts`. Never use floats for money.

**The client never sends prices.** `/api/checkout` accepts product ids and
quantities only; the `place_order` Postgres function re-reads every price, locks
each product row, recomputes the subtotal, shipping and total, and decrements
stock. A shopper cannot post their own total.

**Guest checkout with no accounts.** Orders are looked up by a 244-bit token in
the confirmation URL, not by order number and email — that pair would be an
enumeration oracle over every customer's address.

**RLS is on for every table.** Storefront reads go through the
`products_public` view; all writes are gated behind `is_admin()`. See
`supabase/migrations/0002_admin_authz.sql` for why authorisation lives in a
table rather than a JWT claim.

**Graceful degradation.** `src/lib/data/index.ts` prefers Supabase and falls
back to the seed file, so a misconfigured or unreachable project shows the
catalogue instead of a blank shop.

---

## Layout

```
data/            seed.json — the catalogue, extracted from the live Shopify store
scripts/         build-seed.mjs      — names products from their photography, optimises images
                 build-seed-sql.mjs  — regenerates the seed migration from seed.json
                 colour-names.mjs    — dominant-colour extraction + menswear palette
supabase/
  migrations/    eleven numbered SQL files, one feature each
  README.md      non-technical setup guide
src/
  app/
    (shop)/      storefront routes
    admin/       admin panel — (guarded)/ requires an admin session
    api/         checkout endpoint
  components/
    ui/          primitives (button, eyebrow, section heading, badges)
    site/        storefront chrome and sections
    shop/        product, cart and checkout components
    admin/       admin components
  lib/
    supabase/    browser, server and service clients + the admin guard
    data/        catalogue reads (Supabase, with seed fallback)
    cms/         storefront content (Supabase, with defaults fallback)
    cart/        client-side bag (localStorage)
    checkout/    zod schema shared by form and API
DESIGN.md        the design language — read before touching any UI
```

---

## Design

The visual system is documented in **[DESIGN.md](DESIGN.md)**. The short
version: deep wine burgundy (`#711625`, sampled from the official logo), warm
cream, champagne gold. Playfair Display for display type, Inter for UI. Pills
for buttons and inputs, 1px hairlines, almost no shadow, no dark mode.

Product photography is shot on pure white, so **product images always sit on a
light surface** — never directly on burgundy.

---

## Commands

```bash
npm run dev              # dev server
npm run build            # production build
npm run lint             # eslint
npx tsc --noEmit         # typecheck
node scripts/build-seed.mjs      # rebuild data/seed.json + optimise product images
node scripts/build-seed-sql.mjs  # regenerate supabase/migrations/0008_seed_catalog.sql
```
