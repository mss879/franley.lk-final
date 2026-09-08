-- =============================================================================
-- 0008_seed_catalog.sql
-- FEATURE: The real Franley catalogue — 4 categories and all 49 products
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

insert into public.categories (slug, name, description, parent_id, position, is_active)
values ('neckties', 'Neckties', 'Woven silk-finish neckties in a modern blade width.', null, 1, true)
on conflict (slug) do nothing;

insert into public.categories (slug, name, description, parent_id, position, is_active)
values ('cufflinks', 'Cufflinks', 'Cufflink and tie clip sets in premium alloy, gift boxed.', null, 4, true)
on conflict (slug) do nothing;

insert into public.categories (slug, name, description, parent_id, position, is_active)
select 'plain-ties', 'Plain', 'Solid, fine-twill neckties for everyday tailoring.', p.id, 2, true
  from public.categories p where p.slug = 'neckties'
on conflict (slug) do nothing;

insert into public.categories (slug, name, description, parent_id, position, is_active)
select 'striped-ties', 'Stripes', 'Diagonal repp stripes with a classic city finish.', p.id, 3, true
  from public.categories p where p.slug = 'neckties'
on conflict (slug) do nothing;


-- ---------------------------------------------------------------------------
-- Products. category_id resolves by slug so this file does not depend on the
-- ids the categories happened to get above.
-- ---------------------------------------------------------------------------

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select 'franley-silver-tone-cufflinks-textured-square-3', 'Silver Engine-Turned Cufflink & Tie Clip Set',
       'Classic silver-tone cufflinks crafted from premium metal alloy, paired with a matching tie clip and presented in a luxury FRANLEY gift box.',
       c.id, 179000, null, 'LKR',
       null, null, null, 25, true, 'active', 1
  from public.categories c where c.slug = 'cufflinks'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select 'franley-silver-tone-cufflinks-textured-square-2', 'Silver Diamond Lattice Cufflink & Tie Clip Set',
       'Classic silver-tone cufflinks crafted from premium metal alloy, paired with a matching tie clip and presented in a luxury FRANLEY gift box.',
       c.id, 179000, null, 'LKR',
       null, null, null, 25, true, 'active', 2
  from public.categories c where c.slug = 'cufflinks'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select 'franley-silver-tone-cufflinks-textured-square-1', 'Silver Bevelled Frame Cufflink & Tie Clip Set',
       'Classic silver-tone cufflinks crafted from premium metal alloy, paired with a matching tie clip and presented in a luxury FRANLEY gift box.',
       c.id, 179000, null, 'LKR',
       null, null, null, 25, true, 'active', 3
  from public.categories c where c.slug = 'cufflinks'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select 'franley-silver-tone-cufflinks-textured-square', 'Silver Half-Grid Cufflink & Tie Clip Set',
       'Classic silver-tone cufflinks crafted from premium metal alloy, paired with a matching tie clip and presented in a luxury FRANLEY gift box.',
       c.id, 179000, null, 'LKR',
       null, null, null, 25, false, 'active', 4
  from public.categories c where c.slug = 'cufflinks'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select 'two-tone-diagonal-stripe-tie-2', 'Black & Purple Two-Tone Tie',
       'Make a statement without saying a word. This striking two-tone diagonal stripe tie brings effortless sophistication to your professional ensemble. Featuring bold contrasting bands that flow diagonally across the fabric, this tie creates visual impact while maintaining classic elegance. The textured ribbed finish adds dimension and depth, ensuring you stand out in all the right ways. Versatile enough for the boardroom yet distinctive enough for special occasions, this tie is the secret weapon in a well-dressed man''s arsenal. It pairs beautifully with solid dress shirts and complements a wide range of suit colors, making it an incredibly versatile addition to your rotation. Features: Bold diagonal stripe pattern Contrasting two-tone design Textured ribbed finish Standard tie width Effortlessly pairs with multiple outfits Perfect for: Business meetings and presentations Job interviews Weddings and formal events Date nights and celebrations Where classic meets contemporary—this is the tie that works as hard as you do.',
       c.id, 119000, null, 'LKR',
       'Black', '#0d1a25', 6.5, 25, true, 'active', 5
  from public.categories c where c.slug = 'striped-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select 'two-tone-diagonal-stripe-tie-1', 'Navy & Black Two-Tone Tie',
       'Make a statement without saying a word. This striking two-tone diagonal stripe tie brings effortless sophistication to your professional ensemble. Featuring bold contrasting bands that flow diagonally across the fabric, this tie creates visual impact while maintaining classic elegance. The textured ribbed finish adds dimension and depth, ensuring you stand out in all the right ways. Versatile enough for the boardroom yet distinctive enough for special occasions, this tie is the secret weapon in a well-dressed man''s arsenal. It pairs beautifully with solid dress shirts and complements a wide range of suit colors, making it an incredibly versatile addition to your rotation. Features: Bold diagonal stripe pattern Contrasting two-tone design Textured ribbed finish Standard tie width Effortlessly pairs with multiple outfits Perfect for: Business meetings and presentations Job interviews Weddings and formal events Date nights and celebrations Where classic meets contemporary—this is the tie that works as hard as you do.',
       c.id, 119000, null, 'LKR',
       'Navy', '#152959', 6.5, 25, true, 'active', 6
  from public.categories c where c.slug = 'striped-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select 'two-tone-diagonal-stripe-tie', 'Black & Graphite Two-Tone Tie',
       'Make a statement without saying a word. This striking two-tone diagonal stripe tie brings effortless sophistication to your professional ensemble. Featuring bold contrasting bands that flow diagonally across the fabric, this tie creates visual impact while maintaining classic elegance. The textured ribbed finish adds dimension and depth, ensuring you stand out in all the right ways. Versatile enough for the boardroom yet distinctive enough for special occasions, this tie is the secret weapon in a well-dressed man''s arsenal. It pairs beautifully with solid dress shirts and complements a wide range of suit colors, making it an incredibly versatile addition to your rotation. Features: Bold diagonal stripe pattern Contrasting two-tone design Textured ribbed finish Standard tie width Effortlessly pairs with multiple outfits Perfect for: Business meetings and presentations Job interviews Weddings and formal events Date nights and celebrations Where classic meets contemporary—this is the tie that works as hard as you do.',
       c.id, 119000, null, 'LKR',
       'Black', '#0c1625', 6.5, 25, true, 'active', 7
  from public.categories c where c.slug = 'striped-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select 'classic-black-grey-diagonal-stripe-tie', 'Black & Graphite Two-Tone Tie II',
       'Make a statement without saying a word. This striking two-tone diagonal stripe tie brings effortless sophistication to your professional ensemble. Featuring bold contrasting bands that flow diagonally across the fabric, this tie creates visual impact while maintaining classic elegance. The textured ribbed finish adds dimension and depth, ensuring you stand out in all the right ways. Versatile enough for the boardroom yet distinctive enough for special occasions, this tie is the secret weapon in a well-dressed man''s arsenal. It pairs beautifully with solid dress shirts and complements a wide range of suit colors, making it an incredibly versatile addition to your rotation. Features: Bold diagonal stripe pattern Contrasting two-tone design Textured ribbed finish Standard tie width Effortlessly pairs with multiple outfits Perfect for: Business meetings and presentations Job interviews Weddings and formal events Date nights and celebrations Where classic meets contemporary—this is the tie that works as hard as you do.',
       c.id, 119000, null, 'LKR',
       'Black', '#0b1725', 6.5, 25, false, 'active', 8
  from public.categories c where c.slug = 'striped-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '41', 'Magenta Silk-Finish Tie',
       'A fine twill necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Magenta', '#871657', 6, 25, true, 'active', 9
  from public.categories c where c.slug = 'plain-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '40', 'Pewter Silk-Finish Tie',
       'A fine twill necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Pewter', '#8b738b', 6, 25, true, 'active', 10
  from public.categories c where c.slug = 'plain-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '39', 'Orange Silk-Finish Tie',
       'A fine twill necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Orange', '#b67a43', 6, 25, true, 'active', 11
  from public.categories c where c.slug = 'plain-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '38', 'Graphite Silk-Finish Tie',
       'A fine twill necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Graphite', '#4c5964', 6, 25, false, 'active', 12
  from public.categories c where c.slug = 'plain-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '37', 'Black Silk-Finish Tie',
       'A fine twill necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Black', '#1b2428', 6, 25, false, 'active', 13
  from public.categories c where c.slug = 'plain-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '36', 'Silver Silk-Finish Tie',
       'A fine twill necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Silver', '#a8b7b8', 6, 25, false, 'active', 14
  from public.categories c where c.slug = 'plain-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '35', 'Silver Silk-Finish Tie II',
       'A fine twill necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Silver', '#c7d7d7', 6, 25, false, 'active', 15
  from public.categories c where c.slug = 'plain-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '34', 'Black Silk-Finish Tie II',
       'A fine twill necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Black', '#392623', 6, 25, false, 'active', 16
  from public.categories c where c.slug = 'plain-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '33', 'Teal Silk-Finish Tie',
       'A fine twill necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Teal', '#166986', 6, 25, false, 'active', 17
  from public.categories c where c.slug = 'plain-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '32', 'Navy Silk-Finish Tie',
       'A fine twill necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Navy', '#253a68', 6, 25, false, 'active', 18
  from public.categories c where c.slug = 'plain-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '31', 'Navy Silk-Finish Tie II',
       'A fine twill necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Navy', '#293866', 6, 25, false, 'active', 19
  from public.categories c where c.slug = 'plain-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '30', 'Teal Silk-Finish Tie II',
       'A fine twill necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Teal', '#375b86', 6, 25, false, 'active', 20
  from public.categories c where c.slug = 'plain-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '29', 'Cobalt Silk-Finish Tie',
       'A fine twill necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Cobalt', '#3767c9', 6, 25, false, 'active', 21
  from public.categories c where c.slug = 'plain-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '28', 'Bronze Silk-Finish Tie',
       'A fine twill necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Bronze', '#956936', 6, 25, false, 'active', 22
  from public.categories c where c.slug = 'plain-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '27', 'Pewter Silk-Finish Tie II',
       'A fine twill necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Pewter', '#9b9478', 6, 25, false, 'active', 23
  from public.categories c where c.slug = 'plain-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '26', 'Pewter Silk-Finish Tie III',
       'A fine twill necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Pewter', '#8c8884', 6, 25, false, 'active', 24
  from public.categories c where c.slug = 'plain-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '25', 'Beige Silk-Finish Tie',
       'A fine twill necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Beige', '#d9d8b9', 6, 25, false, 'active', 25
  from public.categories c where c.slug = 'plain-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '24', 'Beige Silk-Finish Tie II',
       'A fine twill necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Beige', '#d8d476', 6, 25, false, 'active', 26
  from public.categories c where c.slug = 'plain-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '23', 'Camel Silk-Finish Tie',
       'A fine twill necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Camel', '#b7b985', 6, 25, false, 'active', 27
  from public.categories c where c.slug = 'plain-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '22', 'Brick Silk-Finish Tie',
       'A fine twill necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Brick', '#cb4737', 6, 25, false, 'active', 28
  from public.categories c where c.slug = 'plain-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '21', 'Plum Silk-Finish Tie',
       'A fine twill necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Plum', '#84466a', 6, 25, false, 'active', 29
  from public.categories c where c.slug = 'plain-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '20', 'Purple Silk-Finish Tie',
       'A fine twill necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Purple', '#56449a', 6, 25, false, 'active', 30
  from public.categories c where c.slug = 'plain-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '19', 'Lavender Silk-Finish Tie',
       'A fine twill necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Lavender', '#ab95c7', 6, 25, false, 'active', 31
  from public.categories c where c.slug = 'plain-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '18', 'Burgundy Silk-Finish Tie',
       'A fine twill necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Burgundy', '#682426', 6, 25, false, 'active', 32
  from public.categories c where c.slug = 'plain-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '17', 'Sky Blue Silk-Finish Tie',
       'Dive into sophistication with our Aqua Elegance Tie, the perfect blend of vibrancy and refinement. This tie boasts a refreshing aqua hue, reminiscent of serene ocean waves, making it ideal for adding a touch of calm confidence to your attire. Crafted from premium materials, its smooth texture and subtle sheen make it a versatile choice for both formal and semi-formal occasions. Pair it with a crisp white shirt for a classic look, or experiment with pastel tones for a modern twist. Whether you''re heading to a wedding, a business meeting, or a night out, the Aqua Elegance Tie ensures you''ll always stand out with understated charm.',
       c.id, 119000, null, 'LKR',
       'Sky Blue', '#79c8c3', 6, 25, false, 'active', 33
  from public.categories c where c.slug = 'plain-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '4', 'Midnight Blue & Black Stripe Tie',
       'A woven diagonal necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Midnight Blue', '#19242b', 6, 25, false, 'active', 34
  from public.categories c where c.slug = 'striped-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '16', 'Black & Graphite Stripe Tie',
       'A woven diagonal necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Black', '#1a232a', 6, 25, false, 'active', 35
  from public.categories c where c.slug = 'striped-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '15', 'Navy & Royal Blue Stripe Tie',
       'A woven diagonal necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Navy', '#152658', 6, 25, false, 'active', 36
  from public.categories c where c.slug = 'striped-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '14', 'Charcoal & Black Stripe Tie',
       'A woven diagonal necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Charcoal', '#35444a', 6, 25, false, 'active', 37
  from public.categories c where c.slug = 'striped-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '13', 'Chocolate & Pewter Stripe Tie',
       'A woven diagonal necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Chocolate', '#533838', 6, 25, false, 'active', 38
  from public.categories c where c.slug = 'striped-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '12', 'Wine & Crimson Stripe Tie',
       'A woven diagonal necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Wine', '#59222c', 6, 25, false, 'active', 39
  from public.categories c where c.slug = 'striped-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '11', 'Midnight Blue & Emerald Stripe Tie',
       'A woven diagonal necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Midnight Blue', '#0d3b33', 6, 25, false, 'active', 40
  from public.categories c where c.slug = 'striped-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '10', 'Wine & Silver Stripe Tie',
       'A woven diagonal necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Wine', '#571925', 6, 25, false, 'active', 41
  from public.categories c where c.slug = 'striped-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '9', 'Royal Blue Stripe Tie',
       'A woven diagonal necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Royal Blue', '#0c2788', 6, 25, false, 'active', 42
  from public.categories c where c.slug = 'striped-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '8', 'Olive & Wine Stripe Tie',
       'A woven diagonal necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Olive', '#776a45', 6, 25, false, 'active', 43
  from public.categories c where c.slug = 'striped-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '7', 'Crimson & Navy Stripe Tie',
       'A woven diagonal necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Crimson', '#872626', 6, 25, false, 'active', 44
  from public.categories c where c.slug = 'striped-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '5', 'Navy & Crimson Stripe Tie',
       'A woven diagonal necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Navy', '#0c2379', 6, 25, false, 'active', 45
  from public.categories c where c.slug = 'striped-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '3', 'Black & Graphite Stripe Tie II',
       'A woven diagonal necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Black', '#141c23', 6, 25, false, 'active', 46
  from public.categories c where c.slug = 'striped-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '2', 'Navy & Teal Stripe Tie',
       'A woven diagonal necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Navy', '#0b247a', 6, 25, false, 'active', 47
  from public.categories c where c.slug = 'striped-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select '1', 'Royal Blue & Navy Stripe Tie',
       'A woven diagonal necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Royal Blue', '#132c87', 6, 25, false, 'active', 48
  from public.categories c where c.slug = 'striped-ties'
on conflict (slug) do nothing;

insert into public.products (
  slug, title, description, category_id, price_cents, compare_at_cents,
  currency, color_name, color_hex, width_cm, stock, featured, status, position)
select 'blue-black', 'Black & Navy Stripe Tie',
       'A woven diagonal necktie cut to a modern 6cm blade. Constructed from a micro-textured fabric with a soft interlining that holds a clean, symmetrical knot and drapes without breaking. Hand-finished with a slip stitch and a matching keeper loop. Presented in FRANLEY packaging.',
       c.id, 119000, null, 'LKR',
       'Black', '#0d1318', 6, 25, false, 'active', 49
  from public.categories c where c.slug = 'striped-ties'
on conflict (slug) do nothing;


-- ---------------------------------------------------------------------------
-- Product images, in display order. Alt text is required for accessibility,
-- so it is written here rather than left for the admin to fill in later.
-- ---------------------------------------------------------------------------

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/franley-silver-tone-cufflinks-textured-square-3-1.webp', 'Silver Engine-Turned Cufflink & Tie Clip Set', 0
  from public.products p where p.slug = 'franley-silver-tone-cufflinks-textured-square-3'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/franley-silver-tone-cufflinks-textured-square-3-2.webp', 'Silver Engine-Turned Cufflink & Tie Clip Set - detail', 1
  from public.products p where p.slug = 'franley-silver-tone-cufflinks-textured-square-3'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/franley-silver-tone-cufflinks-textured-square-2-1.webp', 'Silver Diamond Lattice Cufflink & Tie Clip Set', 0
  from public.products p where p.slug = 'franley-silver-tone-cufflinks-textured-square-2'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/franley-silver-tone-cufflinks-textured-square-2-2.webp', 'Silver Diamond Lattice Cufflink & Tie Clip Set - detail', 1
  from public.products p where p.slug = 'franley-silver-tone-cufflinks-textured-square-2'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/franley-silver-tone-cufflinks-textured-square-1-1.webp', 'Silver Bevelled Frame Cufflink & Tie Clip Set', 0
  from public.products p where p.slug = 'franley-silver-tone-cufflinks-textured-square-1'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/franley-silver-tone-cufflinks-textured-square-1-2.webp', 'Silver Bevelled Frame Cufflink & Tie Clip Set - detail', 1
  from public.products p where p.slug = 'franley-silver-tone-cufflinks-textured-square-1'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/franley-silver-tone-cufflinks-textured-square-1.webp', 'Silver Half-Grid Cufflink & Tie Clip Set', 0
  from public.products p where p.slug = 'franley-silver-tone-cufflinks-textured-square'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/franley-silver-tone-cufflinks-textured-square-2.webp', 'Silver Half-Grid Cufflink & Tie Clip Set - detail', 1
  from public.products p where p.slug = 'franley-silver-tone-cufflinks-textured-square'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/two-tone-diagonal-stripe-tie-2-1.webp', 'Black & Purple Two-Tone Tie', 0
  from public.products p where p.slug = 'two-tone-diagonal-stripe-tie-2'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/two-tone-diagonal-stripe-tie-1-1.webp', 'Navy & Black Two-Tone Tie', 0
  from public.products p where p.slug = 'two-tone-diagonal-stripe-tie-1'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/two-tone-diagonal-stripe-tie-1.webp', 'Black & Graphite Two-Tone Tie', 0
  from public.products p where p.slug = 'two-tone-diagonal-stripe-tie'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/classic-black-grey-diagonal-stripe-tie-1.webp', 'Black & Graphite Two-Tone Tie II', 0
  from public.products p where p.slug = 'classic-black-grey-diagonal-stripe-tie'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/41-1.webp', 'Magenta Silk-Finish Tie', 0
  from public.products p where p.slug = '41'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/41-2.webp', 'Magenta Silk-Finish Tie - detail', 1
  from public.products p where p.slug = '41'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/40-1.webp', 'Pewter Silk-Finish Tie', 0
  from public.products p where p.slug = '40'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/40-2.webp', 'Pewter Silk-Finish Tie - detail', 1
  from public.products p where p.slug = '40'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/39-1.webp', 'Orange Silk-Finish Tie', 0
  from public.products p where p.slug = '39'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/39-2.webp', 'Orange Silk-Finish Tie - detail', 1
  from public.products p where p.slug = '39'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/38-1.webp', 'Graphite Silk-Finish Tie', 0
  from public.products p where p.slug = '38'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/38-2.webp', 'Graphite Silk-Finish Tie - detail', 1
  from public.products p where p.slug = '38'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/37-1.webp', 'Black Silk-Finish Tie', 0
  from public.products p where p.slug = '37'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/37-2.webp', 'Black Silk-Finish Tie - detail', 1
  from public.products p where p.slug = '37'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/36-1.webp', 'Silver Silk-Finish Tie', 0
  from public.products p where p.slug = '36'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/36-2.webp', 'Silver Silk-Finish Tie - detail', 1
  from public.products p where p.slug = '36'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/35-1.webp', 'Silver Silk-Finish Tie II', 0
  from public.products p where p.slug = '35'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/35-2.webp', 'Silver Silk-Finish Tie II - detail', 1
  from public.products p where p.slug = '35'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/34-1.webp', 'Black Silk-Finish Tie II', 0
  from public.products p where p.slug = '34'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/34-2.webp', 'Black Silk-Finish Tie II - detail', 1
  from public.products p where p.slug = '34'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/33-1.webp', 'Teal Silk-Finish Tie', 0
  from public.products p where p.slug = '33'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/33-2.webp', 'Teal Silk-Finish Tie - detail', 1
  from public.products p where p.slug = '33'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/32-1.webp', 'Navy Silk-Finish Tie', 0
  from public.products p where p.slug = '32'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/32-2.webp', 'Navy Silk-Finish Tie - detail', 1
  from public.products p where p.slug = '32'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/31-1.webp', 'Navy Silk-Finish Tie II', 0
  from public.products p where p.slug = '31'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/31-2.webp', 'Navy Silk-Finish Tie II - detail', 1
  from public.products p where p.slug = '31'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/30-1.webp', 'Teal Silk-Finish Tie II', 0
  from public.products p where p.slug = '30'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/30-2.webp', 'Teal Silk-Finish Tie II - detail', 1
  from public.products p where p.slug = '30'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/29-1.webp', 'Cobalt Silk-Finish Tie', 0
  from public.products p where p.slug = '29'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/29-2.webp', 'Cobalt Silk-Finish Tie - detail', 1
  from public.products p where p.slug = '29'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/28-1.webp', 'Bronze Silk-Finish Tie', 0
  from public.products p where p.slug = '28'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/28-2.webp', 'Bronze Silk-Finish Tie - detail', 1
  from public.products p where p.slug = '28'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/27-1.webp', 'Pewter Silk-Finish Tie II', 0
  from public.products p where p.slug = '27'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/27-2.webp', 'Pewter Silk-Finish Tie II - detail', 1
  from public.products p where p.slug = '27'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/26-1.webp', 'Pewter Silk-Finish Tie III', 0
  from public.products p where p.slug = '26'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/26-2.webp', 'Pewter Silk-Finish Tie III - detail', 1
  from public.products p where p.slug = '26'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/25-1.webp', 'Beige Silk-Finish Tie', 0
  from public.products p where p.slug = '25'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/25-2.webp', 'Beige Silk-Finish Tie - detail', 1
  from public.products p where p.slug = '25'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/24-1.webp', 'Beige Silk-Finish Tie II', 0
  from public.products p where p.slug = '24'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/24-2.webp', 'Beige Silk-Finish Tie II - detail', 1
  from public.products p where p.slug = '24'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/23-1.webp', 'Camel Silk-Finish Tie', 0
  from public.products p where p.slug = '23'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/23-2.webp', 'Camel Silk-Finish Tie - detail', 1
  from public.products p where p.slug = '23'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/22-1.webp', 'Brick Silk-Finish Tie', 0
  from public.products p where p.slug = '22'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/22-2.webp', 'Brick Silk-Finish Tie - detail', 1
  from public.products p where p.slug = '22'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/21-1.webp', 'Plum Silk-Finish Tie', 0
  from public.products p where p.slug = '21'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/21-2.webp', 'Plum Silk-Finish Tie - detail', 1
  from public.products p where p.slug = '21'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/20-1.webp', 'Purple Silk-Finish Tie', 0
  from public.products p where p.slug = '20'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/20-2.webp', 'Purple Silk-Finish Tie - detail', 1
  from public.products p where p.slug = '20'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/19-1.webp', 'Lavender Silk-Finish Tie', 0
  from public.products p where p.slug = '19'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/19-2.webp', 'Lavender Silk-Finish Tie - detail', 1
  from public.products p where p.slug = '19'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/18-1.webp', 'Burgundy Silk-Finish Tie', 0
  from public.products p where p.slug = '18'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/18-2.webp', 'Burgundy Silk-Finish Tie - detail', 1
  from public.products p where p.slug = '18'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/17-1.webp', 'Sky Blue Silk-Finish Tie', 0
  from public.products p where p.slug = '17'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/17-2.webp', 'Sky Blue Silk-Finish Tie - detail', 1
  from public.products p where p.slug = '17'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/4-1.webp', 'Midnight Blue & Black Stripe Tie', 0
  from public.products p where p.slug = '4'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/4-2.webp', 'Midnight Blue & Black Stripe Tie - detail', 1
  from public.products p where p.slug = '4'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/16-1.webp', 'Black & Graphite Stripe Tie', 0
  from public.products p where p.slug = '16'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/16-2.webp', 'Black & Graphite Stripe Tie - detail', 1
  from public.products p where p.slug = '16'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/15-1.webp', 'Navy & Royal Blue Stripe Tie', 0
  from public.products p where p.slug = '15'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/15-2.webp', 'Navy & Royal Blue Stripe Tie - detail', 1
  from public.products p where p.slug = '15'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/14-1.webp', 'Charcoal & Black Stripe Tie', 0
  from public.products p where p.slug = '14'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/14-2.webp', 'Charcoal & Black Stripe Tie - detail', 1
  from public.products p where p.slug = '14'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/13-1.webp', 'Chocolate & Pewter Stripe Tie', 0
  from public.products p where p.slug = '13'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/13-2.webp', 'Chocolate & Pewter Stripe Tie - detail', 1
  from public.products p where p.slug = '13'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/12-1.webp', 'Wine & Crimson Stripe Tie', 0
  from public.products p where p.slug = '12'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/12-2.webp', 'Wine & Crimson Stripe Tie - detail', 1
  from public.products p where p.slug = '12'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/11-1.webp', 'Midnight Blue & Emerald Stripe Tie', 0
  from public.products p where p.slug = '11'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/11-2.webp', 'Midnight Blue & Emerald Stripe Tie - detail', 1
  from public.products p where p.slug = '11'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/10-1.webp', 'Wine & Silver Stripe Tie', 0
  from public.products p where p.slug = '10'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/10-2.webp', 'Wine & Silver Stripe Tie - detail', 1
  from public.products p where p.slug = '10'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/9-1.webp', 'Royal Blue Stripe Tie', 0
  from public.products p where p.slug = '9'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/9-2.webp', 'Royal Blue Stripe Tie - detail', 1
  from public.products p where p.slug = '9'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/8-1.webp', 'Olive & Wine Stripe Tie', 0
  from public.products p where p.slug = '8'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/8-2.webp', 'Olive & Wine Stripe Tie - detail', 1
  from public.products p where p.slug = '8'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/7-1.webp', 'Crimson & Navy Stripe Tie', 0
  from public.products p where p.slug = '7'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/7-2.webp', 'Crimson & Navy Stripe Tie - detail', 1
  from public.products p where p.slug = '7'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/5-1.webp', 'Navy & Crimson Stripe Tie', 0
  from public.products p where p.slug = '5'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/5-2.webp', 'Navy & Crimson Stripe Tie - detail', 1
  from public.products p where p.slug = '5'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/3-1.webp', 'Black & Graphite Stripe Tie II', 0
  from public.products p where p.slug = '3'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/3-2.webp', 'Black & Graphite Stripe Tie II - detail', 1
  from public.products p where p.slug = '3'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/2-1.webp', 'Navy & Teal Stripe Tie', 0
  from public.products p where p.slug = '2'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/2-2.webp', 'Navy & Teal Stripe Tie - detail', 1
  from public.products p where p.slug = '2'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/1-1.webp', 'Royal Blue & Navy Stripe Tie', 0
  from public.products p where p.slug = '1'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/1-2.webp', 'Royal Blue & Navy Stripe Tie - detail', 1
  from public.products p where p.slug = '1'
on conflict (product_id, url) do nothing;

insert into public.product_images (product_id, url, alt, position)
select p.id, '/products/blue-black-1.webp', 'Black & Navy Stripe Tie', 0
  from public.products p where p.slug = 'blue-black'
on conflict (product_id, url) do nothing;


-- ---------------------------------------------------------------------------
-- Sanity report. Expect: 4 categories, 49 products, 93 images.
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
