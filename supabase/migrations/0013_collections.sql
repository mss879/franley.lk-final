-- =============================================================================
-- 0013_collections.sql
-- FEATURE: Real, curated collections. A collection is a hand-picked, ordered
--          list of products the owner composes in the admin ("Featured",
--          "Cufflinks & Clips", a seasonal edit). A product may sit in any
--          number of collections at once, independent of the one category it
--          lives in.
--
-- SAFE TO RE-RUN: yes. Tables use CREATE TABLE IF NOT EXISTS, indexes use
--          IF NOT EXISTS, policies and triggers are dropped before being
--          created, the view is dropped and re-created, and the seed at the
--          bottom is ON CONFLICT DO NOTHING and never re-adds a member to a
--          collection that already has any (see the seed section).
--
-- WHY A TABLE PAIR AND NOT products.featured / ANOTHER CATEGORY:
--   * products.featured is one boolean. It can express exactly one list, in
--     no order of its own, and the storefront home page is the only thing
--     that can read it.
--   * A category is where a product LIVES; every product has exactly one. A
--     collection is where a product is SHOWN, and a navy tie belongs in
--     "Plain", in "Featured" and in "Wedding season" at the same time. That is
--     a many-to-many, so it gets a join table with its own ordering column.
--
-- ONE SLUG NAMESPACE FOR CATEGORIES AND COLLECTIONS:
--   The storefront serves both from /collections/<slug>, resolving a
--   collection first and then a category. A slug present in both tables
--   would make one of the two unreachable, so a pair of triggers refuses the
--   overlap in either direction. They are SECURITY DEFINER so the check sees
--   every row: an inactive category (hidden from a non-admin by RLS) still
--   owns its slug.
--
-- RE-RUN THIS FILE AFTER ANY CHANGE TO products_public. The view at the bottom
--   selects p.* from that view, and a view's column list is frozen when it is
--   created — a column added to products_public later does not appear here
--   until this file is run again.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- collections
-- -----------------------------------------------------------------------------
create table if not exists public.collections (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique
                  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 2 and 64),
  name          text not null check (length(btrim(name)) between 1 and 80),
  description   text check (description is null or length(description) <= 500),
  -- The small line above the collection title on its storefront page.
  hero_eyebrow  text check (hero_eyebrow is null or length(hero_eyebrow) <= 60),
  -- Same rule as categories.image_url: is_safe_asset_url() accepts NULL and
  -- rejects script-bearing schemes, since this is rendered into <img src>.
  image_url     text check (public.is_safe_asset_url(image_url)),
  position      integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.collections is
  'A curated, ordered list of products. Served at /collections/<slug>, sharing that URL space with categories. Admin Collections page writes this.';

create index if not exists collections_active_idx
  on public.collections (position) where is_active;

drop trigger if exists trg_collections_updated_at on public.collections;
create trigger trg_collections_updated_at
  before update on public.collections
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- collection_products — the membership, with a per-collection order
-- -----------------------------------------------------------------------------
-- CASCADE on both sides: a membership row means nothing without either parent.
-- (Contrast categories.parent_id, which RESTRICTs, because a category holds
-- the products themselves; a collection only points at them.)
create table if not exists public.collection_products (
  collection_id uuid not null references public.collections(id) on delete cascade,
  product_id    uuid not null references public.products(id) on delete cascade,
  position      integer not null default 0 check (position >= 0),
  created_at    timestamptz not null default now(),
  primary key (collection_id, product_id)
);

comment on table public.collection_products is
  'Which products are in which collection, and in what order. One row per (collection, product).';

create index if not exists collection_products_collection_idx
  on public.collection_products (collection_id, position);
create index if not exists collection_products_product_idx
  on public.collection_products (product_id);

-- -----------------------------------------------------------------------------
-- Slug namespace: a collection may not take a category's slug, and vice versa.
-- -----------------------------------------------------------------------------
-- errcode 23505 (unique_violation) on purpose: to the admin form this IS a
-- uniqueness failure, and the app already maps 23505 to "that slug is taken".
create or replace function public.tg_collections_slug_free()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.categories c where c.slug = new.slug) then
    raise exception 'A category already uses the slug %', new.slug
      using errcode = '23505';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_collections_slug_free on public.collections;
create trigger trg_collections_slug_free
  before insert or update of slug on public.collections
  for each row execute function public.tg_collections_slug_free();

create or replace function public.tg_categories_slug_free()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.collections c where c.slug = new.slug) then
    raise exception 'A collection already uses the slug %', new.slug
      using errcode = '23505';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_categories_slug_free on public.categories;
create trigger trg_categories_slug_free
  before insert or update of slug on public.categories
  for each row execute function public.tg_categories_slug_free();

-- Trigger functions are never called directly; as in 0001, take back the
-- default EXECUTE TO PUBLIC anyway.
revoke execute on function public.tg_collections_slug_free() from public;
revoke execute on function public.tg_categories_slug_free()  from public;

-- -----------------------------------------------------------------------------
-- RLS + grants — the categories / product_images pattern from 0003, exactly.
-- -----------------------------------------------------------------------------
alter table public.collections         enable row level security;
alter table public.collection_products enable row level security;

drop policy if exists collections_public_read   on public.collections;
drop policy if exists collections_admin_insert  on public.collections;
drop policy if exists collections_admin_update  on public.collections;
drop policy if exists collections_admin_delete  on public.collections;

-- An inactive collection is unreadable, not merely un-rendered — same reasoning
-- as categories_public_read.
create policy collections_public_read on public.collections
  for select to anon, authenticated
  using (is_active or (select public.is_admin()));

create policy collections_admin_insert on public.collections
  for insert to authenticated
  with check ((select public.is_admin()));

create policy collections_admin_update on public.collections
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy collections_admin_delete on public.collections
  for delete to authenticated
  using ((select public.is_admin()));

grant select on public.collections to anon;
grant select, insert, update, delete on public.collections to authenticated;

drop policy if exists collection_products_public_read  on public.collection_products;
drop policy if exists collection_products_admin_insert on public.collection_products;
drop policy if exists collection_products_admin_update on public.collection_products;
drop policy if exists collection_products_admin_delete on public.collection_products;

-- Both EXISTS clauses are load-bearing, the same child-table leak
-- product_images_public_read closes: without them the membership rows of an
-- unpublished collection, or of a draft product, would be public even though
-- the parent rows are not.
create policy collection_products_public_read on public.collection_products
  for select to anon, authenticated
  using (
    (select public.is_admin())
    or (
      exists (
        select 1 from public.collections c
         where c.id = collection_products.collection_id
           and c.is_active
      )
      and exists (
        select 1 from public.products p
         where p.id = collection_products.product_id
           and p.status = 'active'
      )
    )
  );

create policy collection_products_admin_insert on public.collection_products
  for insert to authenticated
  with check ((select public.is_admin()));

create policy collection_products_admin_update on public.collection_products
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy collection_products_admin_delete on public.collection_products
  for delete to authenticated
  using ((select public.is_admin()));

grant select on public.collection_products to anon;
grant select, insert, update, delete on public.collection_products to authenticated;

-- -----------------------------------------------------------------------------
-- Storefront read convenience view: a collection page in one query.
-- -----------------------------------------------------------------------------
-- security_invoker = true is MANDATORY (0010 asserts it): the view must run as
-- the caller so the three RLS policies above still apply through it.
--
-- DROP + CREATE rather than CREATE OR REPLACE: OR REPLACE can only append
-- columns, and p.* below must track products_public exactly, so a re-run has
-- to be able to rebuild the column list from scratch.
drop view if exists public.collection_products_public;
create view public.collection_products_public
  with (security_invoker = true)
as
  select
    c.slug      as collection_slug,
    cp.collection_id,
    cp.position as item_position,
    p.*
  from public.collection_products cp
  join public.collections     c on c.id = cp.collection_id
  join public.products_public p on p.id = cp.product_id;

comment on view public.collection_products_public is
  'One row per (collection, product) with the full products_public record. Filter on collection_slug, order by item_position. Re-run 0013 after any change to products_public.';

grant select on public.collection_products_public to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Seed: two collections the storefront links to from day one.
-- -----------------------------------------------------------------------------
-- The collections themselves are ON CONFLICT (slug) DO NOTHING, like every
-- seed in 0008/0009. Members are inserted ONLY into a collection that has no
-- members at all, so a re-run never puts back a product the owner removed in
-- the admin. To reset a collection to this seed, delete its rows from
-- collection_products and run this file again.
insert into public.collections (slug, name, description, hero_eyebrow, position, is_active)
values
  ('featured', 'Featured',
   'The pieces we would put in your hands first.', 'Editor''s picks', 1, true),
  ('cufflinks-and-clips', 'Cufflinks & Clips',
   'Every cufflink and tie clip set, gift boxed.', 'Finishing details', 2, true)
on conflict (slug) do nothing;

-- 'featured' starts as every featured, active product in catalogue order.
insert into public.collection_products (collection_id, product_id, position)
select c.id, p.id,
       (row_number() over (order by p.position, p.created_at) - 1)::integer
  from public.collections c
  join public.products p on p.featured and p.status = 'active'
 where c.slug = 'featured'
   and not exists (select 1 from public.collection_products cp where cp.collection_id = c.id)
on conflict do nothing;

-- 'cufflinks-and-clips' starts as every active product in the cufflinks category.
insert into public.collection_products (collection_id, product_id, position)
select c.id, p.id,
       (row_number() over (order by p.position, p.created_at) - 1)::integer
  from public.collections c
  join public.categories cat on cat.slug = 'cufflinks'
  join public.products p on p.category_id = cat.id and p.status = 'active'
 where c.slug = 'cufflinks-and-clips'
   and not exists (select 1 from public.collection_products cp where cp.collection_id = c.id)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Sanity report. On the seeded catalogue expect: 2 collections, 13 members
-- (9 featured + 4 cufflinks).
-- ---------------------------------------------------------------------------
do $$
declare c int; m int;
begin
  select count(*) into c from public.collections;
  select count(*) into m from public.collection_products;
  raise notice 'Franley collections: % collections, % members', c, m;
end
$$;
