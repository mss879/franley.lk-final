import fs from "node:fs";

const { categories, products } = JSON.parse(fs.readFileSync("data/seed.json", "utf8"));
const q = (v) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);

const parents = categories.filter((c) => !c.parent);
const children = categories.filter((c) => c.parent);

let sql = `-- =============================================================================
-- 0008_seed_catalog.sql
-- FEATURE: The real Franley catalogue — ${categories.length} categories and all ${products.length} products
--          with their images — generated from data/seed.json by
--          scripts/build-seed-sql.mjs. Regenerate rather than hand-editing.
--
-- SAFE TO RE-RUN: yes. Every statement uses ON CONFLICT ... DO NOTHING, so a
--          re-run inserts nothing and never overwrites an edit the client has
--          since made in the admin.
--
-- NOTES
--   * Money is integer cents: Rs 1,190.00 = 119000, Rs 1,790.00 = 179000.
--   * Shopify listed several distinct designs under one title (four cufflink
--     sets all called "Textured Square"; five different ties all called
--     "Blue"). Titles here are derived from the actual product photography —
--     the cufflink face pattern, and the dominant woven colours — so every
--     product is separately identifiable in a grid. Only one listing was
--     dropped, a genuine duplicate whose photograph was byte-identical.
--   * Image paths are the local files in public/products. They satisfy
--     product_images.url's CHECK, which accepts site-relative paths as well as
--     storage keys and https URLs. Uploads made later through the admin land
--     in the product-images bucket alongside them.
--   * Slugs are exactly as scraped, including the bare-number ones ('41',
--     '38'). They are permanent public URLs, so they are NOT rewritten here.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Categories: parents first, then children resolving their parent by slug.
-- ---------------------------------------------------------------------------

`;

for (const c of parents) {
  sql += `insert into public.categories (slug, name, description, parent_id, position, is_active)
values (${q(c.slug)}, ${q(c.name)}, ${q(c.description)}, null, ${c.position}, true)
on conflict (slug) do nothing;

`;
}
for (const c of children) {
  sql += `insert into public.categories (slug, name, description, parent_id, position, is_active)
select ${q(c.slug)}, ${q(c.name)}, ${q(c.description)}, p.id, ${c.position}, true
  from public.categories p where p.slug = ${q(c.parent)}
on conflict (slug) do nothing;

`;
}

sql += `
-- ---------------------------------------------------------------------------
-- Products. category_id resolves by slug so this file does not depend on the
-- ids the categories happened to get above.
-- ---------------------------------------------------------------------------

`;

products.forEach((p, i) => {
  sql += `insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select ${q(p.slug)}, ${q(p.title)},
       ${q(p.description)},
       c.id, ${p.price_cents}, ${p.compare_at_cents || "null"}, 'LKR',
       ${q(p.color_name)}, ${q(p.color_hex)}, ${p.width_cm ?? "null"}, ${p.stock}, ${p.featured}, 'active', ${i + 1}
  from public.categories c where c.slug = ${q(p.category)}
on conflict (slug) do nothing;

`;
});

sql += `
-- ---------------------------------------------------------------------------
-- Product images, in display order. Alt text is required for accessibility,
-- so it is written here rather than left for the admin to fill in later.
-- ---------------------------------------------------------------------------

`;

for (const p of products) {
  p.images.forEach((url, n) => {
    const alt = n === 0 ? p.title : `${p.title} - detail`;
    sql += `insert into public.product_images (product_id, url, alt, position)
select p.id, ${q(url)}, ${q(alt)}, ${n}
  from public.products p where p.slug = ${q(p.slug)}
on conflict (product_id, url) do nothing;

`;
  });
}

const imageCount = products.reduce((n, p) => n + p.images.length, 0);
sql += `
-- ---------------------------------------------------------------------------
-- Sanity report. Expect: ${categories.length} categories, ${products.length} products, ${imageCount} images.
-- ---------------------------------------------------------------------------
do $$
declare c int; p int; i int;
begin
  select count(*) into c from public.categories;
  select count(*) into p from public.products;
  select count(*) into i from public.product_images;
  raise notice 'Franley catalogue: % categories, % products, % images', c, p, i;
end
$$;
`;

fs.writeFileSync("supabase/migrations/0008_seed_catalog.sql", sql);
console.log(`wrote 0008_seed_catalog.sql — ${categories.length} categories, ${products.length} products, ${imageCount} images`);
