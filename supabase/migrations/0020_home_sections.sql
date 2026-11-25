-- =============================================================================
-- 0020_home_sections.sql
-- FEATURE: The home page's product sections are picked by hand.
--
--          The home page has three product sections — "Featured" (the grid),
--          "New in" and "Trending" (the two card rails). Each one now shows
--          the products of a COLLECTION, in that collection's order, under a
--          heading the owner writes:
--
--            home section   content_blocks row   collection it reads
--            ------------   ------------------   -------------------
--            Featured       home / collection    featured
--            New in         home / lookbook      new-in
--            Trending       home / trending      trending   (new section)
--
--          Which collection a section reads is stored in its block's payload
--          ("collection": "<slug>") and chosen in Admin -> Home page & Banners,
--          so the owner can also point a section at any other collection.
--          Choosing the products themselves is Admin -> Collections -> <name>.
--
-- WHY: before this file the Featured grid read products.featured and the
--          New-in rail read "the eight newest products". The "Featured"
--          collection seeded in 0013 had its own page (/collections/featured)
--          but nothing on the home page read it, so editing it changed
--          nothing the owner could see. Now that collection IS the grid.
--
-- NO NEW TABLES. The sections are content_blocks rows (0004) and the
--          product lists are collections + collection_products (0013), so
--          every RLS policy, grant and publish-window rule already in place
--          applies unchanged. No functions are created here either.
--
-- SAFE TO RE-RUN: yes, and non-destructive.
--   * Collections are ON CONFLICT (slug) DO NOTHING, and are skipped
--     outright when a CATEGORY already owns the slug (0013's slug-namespace
--     trigger would otherwise abort the file).
--   * Products are seeded ONLY into a collection this run itself created, so
--     a re-run never refills a collection the owner has edited or emptied.
--   * The two existing heading blocks get their "Products shown" field only
--     if they do not have it yet; the new Trending block is
--     ON CONFLICT (page, key) DO NOTHING.
--
-- THE LOCK GUARD: 0004's tg_content_blocks_lock_guard refuses any change to
--          the `fields` of a locked block. Changing the schema is the
--          developer act that guard exists for, so the block below unlocks
--          each row, adds the field, and puts the lock back as it was.
--
-- STOREFRONT FALLBACK: if a section's collection is missing, hidden or has
--          no active products, the Featured grid falls back to products
--          marked Featured and New in to the newest products (the behaviour
--          before this file); Trending, which had no automatic list, is not
--          shown. So the home page never goes blank.
--
-- UNPUBLISHING a section's block now hides that section (before this file
--          it only reverted the heading to the built-in default).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. The collections the three sections read, each pre-filled so the live
--    home page looks the same the moment this runs.
-- -----------------------------------------------------------------------------
--   featured  every featured, active product in catalogue order (as in 0013;
--             normally it already exists from 0013 and is left alone)
--   new-in    the eight newest active products
--   trending  the eight active products with the most units on live orders in
--             the last 90 days, then featured, then catalogue order — so a
--             shop with no orders yet still gets a sensible eight
with created as (
  insert into public.collections (slug, name, description, hero_eyebrow, position, is_active)
  select v.slug, v.name, v.description, v.hero_eyebrow, v.position, true
    from (values
      ('featured', 'Featured',
       'The pieces we would put in your hands first.', 'Editor''s picks', 1),
      ('new-in', 'New In',
       'The latest additions to the range.', 'Just in', 3),
      ('trending', 'Trending',
       'The pieces customers keep coming back for.', 'Most wanted', 4)
    ) as v(slug, name, description, hero_eyebrow, position)
   where not exists (select 1 from public.categories c where c.slug = v.slug)
  on conflict (slug) do nothing
  returning id, slug
),
sold as (
  select oi.product_id, sum(oi.quantity) as units
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
   where oi.product_id is not null
     and o.status in ('pending', 'confirmed', 'packed', 'shipped', 'delivered')
     and o.created_at > now() - interval '90 days'
   group by oi.product_id
),
picks as (
  select cr.id as collection_id, p.id as product_id,
         row_number() over (partition by cr.id order by p.position, p.created_at) - 1 as pos,
         null::integer as cap
    from created cr
    join public.products p on p.featured and p.status = 'active'
   where cr.slug = 'featured'
  union all
  select cr.id, p.id,
         row_number() over (partition by cr.id order by p.created_at desc, p.id) - 1,
         8
    from created cr
    join public.products p on p.status = 'active'
   where cr.slug = 'new-in'
  union all
  select cr.id, p.id,
         row_number() over (
           partition by cr.id
           order by coalesce(s.units, 0) desc, p.featured desc, p.position, p.created_at
         ) - 1,
         8
    from created cr
    join public.products p on p.status = 'active'
    left join sold s on s.product_id = p.id
   where cr.slug = 'trending'
)
insert into public.collection_products (collection_id, product_id, position)
select collection_id, product_id, pos::integer
  from picks
 where cap is null or pos < cap
on conflict do nothing;


-- -----------------------------------------------------------------------------
-- 2. The existing Featured and New-in heading blocks learn which collection
--    they show.
-- -----------------------------------------------------------------------------
do $$
declare
  r record;
  products_field jsonb := '[{"name": "collection", "label": "Products shown", "type": "collection", "required": false, "help": "The collection whose products fill this section, in that collection''s order. Choose the products themselves under Collections."}]'::jsonb;
begin
  for r in
    select b.id, b.key, b.is_locked
      from public.content_blocks b
     where b.page = 'home'
       and b.key in ('collection', 'lookbook')
       and not exists (
         select 1 from jsonb_array_elements(b.fields) f where f->>'name' = 'collection'
       )
  loop
    update public.content_blocks set is_locked = false where id = r.id;

    update public.content_blocks
       set fields  = fields || products_field,
           payload = case
                       when jsonb_typeof(payload) = 'object' and not (payload ? 'collection')
                         then payload || jsonb_build_object(
                                'collection',
                                case r.key when 'collection' then 'featured' else 'new-in' end)
                       else payload
                     end,
           label   = case r.key when 'collection' then 'Featured products section'
                                else 'New in section' end,
           help    = case r.key
                       when 'collection' then 'The grid of products under the category cards. Write its heading here and choose which collection fills it. Unpublish it to hide the section.'
                       else 'The rail of product cards on the tinted band. Write its heading here and choose which collection fills it. Unpublish it to hide the section.'
                     end
     where id = r.id;

    update public.content_blocks set is_locked = r.is_locked where id = r.id;
  end loop;
end
$$;


-- -----------------------------------------------------------------------------
-- 3. The new Trending section's heading block.
-- -----------------------------------------------------------------------------
insert into public.content_blocks (page, key, label, help, payload, fields, is_locked, published, position)
values ('home', 'trending', 'Trending section',
        'A rail of product cards near the bottom of the home page. Write its heading here and choose which collection fills it. Unpublish it to hide the section.',
        '{"eyebrow": "Trending", "title": "Most wanted right now", "lede": "The pieces customers keep coming back for.", "collection": "trending"}'::jsonb,
        '[{"name": "eyebrow", "label": "Small line above the title", "type": "text", "max_length": 60}, {"name": "title", "label": "Title", "type": "text", "required": true, "max_length": 80}, {"name": "lede", "label": "Intro line", "type": "textarea", "max_length": 240, "rows": 2}, {"name": "collection", "label": "Products shown", "type": "collection", "required": false, "help": "The collection whose products fill this section, in that collection''s order. Choose the products themselves under Collections."}]'::jsonb,
        true, true, 8)
on conflict (page, key) do nothing;


-- ---------------------------------------------------------------------------
-- Sanity report. On the seeded catalogue expect featured / new-in / trending
-- to exist, new-in and trending with 8 members each.
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select c.slug, count(cp.product_id) as members
      from public.collections c
      left join public.collection_products cp on cp.collection_id = c.id
     where c.slug in ('featured', 'new-in', 'trending')
     group by c.slug
     order by c.slug
  loop
    raise notice 'Franley home section collection %: % products', r.slug, r.members;
  end loop;
end
$$;
