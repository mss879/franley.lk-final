-- =============================================================================
-- 0003_catalog.sql
-- FEATURE: Catalogue — self-referential categories, flat products, ordered
--          product images. Public read of live rows, admin-only writes.
--
-- SAFE TO RE-RUN: yes. Tables use CREATE TABLE IF NOT EXISTS, indexes use
--          IF NOT EXISTS, policies are dropped before being created, triggers
--          are dropped before being created.
--
-- VARIANTS: deliberately not modelled. All 29 products in data/seed.json are
--          single-variant (one width, one colour, one price). A variants table
--          would be exactly one row per product forever: an extra join on
--          every storefront query, a second RLS surface, a second admin form,
--          and two levels of row locking inside place_order instead of one.
--          The escape hatch is designed in now so the later migration is purely
--          ADDITIVE: order_items snapshots product_title / product_slug /
--          unit_price_cents and carries a nullable variant_label, so adding
--          product_variants + a nullable order_items.variant_id later needs no
--          rewrite of existing orders. Accepted cost, stated plainly: the same
--          tie in two blade widths needs two product rows and two slugs. At 29
--          SKUs that is cheaper than the join.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- categories (self-referential: neckties > plain-ties, striped-ties; cufflinks)
-- -----------------------------------------------------------------------------
create table if not exists public.categories (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique
                 check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 2 and 64),
  name         text not null check (length(btrim(name)) between 1 and 80),
  description  text check (description is null or length(description) <= 500),
  -- RESTRICT, never CASCADE: deleting a parent must fail loudly, not silently
  -- delete a whole subtree of categories out from under the products in them.
  parent_id    uuid references public.categories(id) on delete restrict,
  position     integer not null default 0,
  image_url    text check (public.is_safe_asset_url(image_url)),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint categories_no_self_parent check (parent_id is distinct from id)
);

comment on table public.categories is
  'Two-level category tree. Admin Categories page writes this; products are assigned into it.';

create index if not exists categories_parent_position_idx
  on public.categories (parent_id nulls first, position);
create index if not exists categories_active_idx
  on public.categories (position) where is_active;

drop trigger if exists trg_categories_updated_at on public.categories;
create trigger trg_categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- A CHECK can only catch self-parenting. A -> B -> A needs a walk. An
-- unbounded or cyclic tree turns the storefront's recursive category query
-- into an infinite loop, i.e. a self-inflicted denial of service.
create or replace function public.tg_categories_no_cycle()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_parent uuid := new.parent_id;
  v_depth  int  := 0;
begin
  while v_parent is not null loop
    v_depth := v_depth + 1;
    if v_parent = new.id then
      raise exception 'Category parent chain is circular' using errcode = '23514';
    end if;
    if v_depth > 1 then
      raise exception 'Categories may only nest two levels deep (a top-level category and its children)'
        using errcode = '23514';
    end if;
    select c.parent_id into v_parent from public.categories c where c.id = v_parent;
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_categories_no_cycle on public.categories;
create trigger trg_categories_no_cycle
  before insert or update of parent_id on public.categories
  for each row execute function public.tg_categories_no_cycle();

alter table public.categories enable row level security;

drop policy if exists categories_public_read   on public.categories;
drop policy if exists categories_admin_insert  on public.categories;
drop policy if exists categories_admin_update  on public.categories;
drop policy if exists categories_admin_delete  on public.categories;

-- Visibility is an RLS concern, not an application concern: a deactivated
-- category is unreadable, not merely un-rendered, so a forgotten
-- .eq('is_active', true) in an RSC is a rendering bug, never a disclosure.
create policy categories_public_read on public.categories
  for select to anon, authenticated
  using (is_active or (select public.is_admin()));

create policy categories_admin_insert on public.categories
  for insert to authenticated
  with check ((select public.is_admin()));

-- Both USING and WITH CHECK, always. USING gates which rows you may touch;
-- WITH CHECK gates what they may become. An UPDATE policy with only USING is
-- the single most common RLS bug.
create policy categories_admin_update on public.categories
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy categories_admin_delete on public.categories
  for delete to authenticated
  using ((select public.is_admin()));

grant select on public.categories to anon;
grant select, insert, update, delete on public.categories to authenticated;

-- -----------------------------------------------------------------------------
-- products
-- -----------------------------------------------------------------------------
create table if not exists public.products (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique
                      check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 1 and 96),
  title             text not null check (length(btrim(title)) between 2 and 200),
  description       text check (description is null or length(description) <= 8000),
  category_id       uuid not null references public.categories(id) on delete restrict,
  price_cents       integer not null check (price_cents > 0 and price_cents <= 100000000),
  -- seed.json carries 0 for "no sale price"; the seed migration writes
  -- nullif(compare_at_cents, 0) so this constraint holds.
  compare_at_cents  integer check (compare_at_cents is null or compare_at_cents > price_cents),
  currency          char(3) not null default 'LKR' check (currency = 'LKR'),
  color_name        text check (color_name is null or length(color_name) <= 40),
  color_hex         text check (color_hex is null or color_hex ~* '^#[0-9a-f]{6}$'),
  width_cm          numeric(3,1) check (width_cm is null or width_cm between 1 and 20),
  -- Last line of defence against overselling. SELECT ... FOR UPDATE inside
  -- place_order is the first.
  stock             integer not null default 0 check (stock >= 0),
  low_stock_threshold integer not null default 3 check (low_stock_threshold >= 0),
  featured          boolean not null default false,
  status            public.product_status not null default 'active',
  position          integer not null default 0,
  -- 2-arg regconfig form is required: the 1-arg to_tsvector(text) is STABLE,
  -- not IMMUTABLE, and is rejected in a generated column.
  search_tsv        tsvector generated always as (
                      to_tsvector('simple'::regconfig,
                        coalesce(title, '') || ' ' ||
                        coalesce(color_name, '') || ' ' ||
                        coalesce(description, ''))
                    ) stored,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.products is
  'Flat product record — no variants (see the header of 0003_catalog.sql). Money is integer cents, currency LKR.';
comment on column public.products.status is
  'active = on the storefront. draft = not yet released. archived = soft delete; order history keeps pointing here.';

create index if not exists products_live_idx
  on public.products (category_id, position, created_at desc) where status = 'active';
create index if not exists products_featured_idx
  on public.products (position) where featured and status = 'active';
create index if not exists products_search_idx
  on public.products using gin (search_tsv);
create index if not exists products_low_stock_idx
  on public.products (stock) where status = 'active';
create index if not exists products_category_idx
  on public.products (category_id);

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

alter table public.products enable row level security;

drop policy if exists products_public_read  on public.products;
drop policy if exists products_admin_insert on public.products;
drop policy if exists products_admin_update on public.products;
drop policy if exists products_admin_delete on public.products;

-- A draft or archived product is invisible AT THE DATABASE, so an unfinished
-- listing can never be scraped off the PostgREST endpoint.
create policy products_public_read on public.products
  for select to anon, authenticated
  using (status = 'active' or (select public.is_admin()));

create policy products_admin_insert on public.products
  for insert to authenticated
  with check ((select public.is_admin()));

create policy products_admin_update on public.products
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy products_admin_delete on public.products
  for delete to authenticated
  using ((select public.is_admin()));

grant select on public.products to anon;
grant select, insert, update, delete on public.products to authenticated;

-- Note: stock is decremented ONLY inside place_order, which runs as the table
-- owner and is therefore exempt from these policies. No policy anywhere lets a
-- shopper write stock.

-- -----------------------------------------------------------------------------
-- product_images
-- -----------------------------------------------------------------------------
-- A child table rather than a text[] column on products: the admin must
-- reorder, re-alt and delete individual images, and an array forces a
-- read-modify-write race and cannot be constrained per element.
create table if not exists public.product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  -- Holds a site-relative seed path (/products/x.webp), a Supabase Storage
  -- object key (product-images/...) or an https URL. See is_safe_asset_url.
  url         text not null check (public.is_safe_asset_url(url)),
  -- Provenance when the file was uploaded through the admin media picker.
  media_id    uuid,
  alt         text check (alt is null or length(alt) <= 300),
  position    integer not null default 0 check (position >= 0),
  width       integer check (width is null or width > 0),
  height      integer check (height is null or height > 0),
  created_at  timestamptz not null default now()
);

comment on column public.product_images.media_id is
  'Optional FK to public.media_assets, wired up in 0004 (media is created after the catalogue so this file has no forward dependency).';

create index if not exists product_images_product_idx
  on public.product_images (product_id, position);
create unique index if not exists product_images_product_url_key
  on public.product_images (product_id, url);

alter table public.product_images enable row level security;

drop policy if exists product_images_public_read  on public.product_images;
drop policy if exists product_images_admin_insert on public.product_images;
drop policy if exists product_images_admin_update on public.product_images;
drop policy if exists product_images_admin_delete on public.product_images;

-- The EXISTS is load-bearing and is the classic child-table leak: without it,
-- photographs of an unreleased product are public even though the product row
-- itself is not.
create policy product_images_public_read on public.product_images
  for select to anon, authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.products p
       where p.id = product_images.product_id
         and p.status = 'active'
    )
  );

create policy product_images_admin_insert on public.product_images
  for insert to authenticated
  with check ((select public.is_admin()));

create policy product_images_admin_update on public.product_images
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy product_images_admin_delete on public.product_images
  for delete to authenticated
  using ((select public.is_admin()));

grant select on public.product_images to anon;
grant select, insert, update, delete on public.product_images to authenticated;

-- -----------------------------------------------------------------------------
-- Storefront read convenience view
-- -----------------------------------------------------------------------------
-- security_invoker = true is MANDATORY. A plain view executes with its owner's
-- privileges and would bypass RLS on everything it selects from. 0010 asserts
-- that every view in public carries this.
create or replace view public.products_public
  with (security_invoker = true)
as
  select
    p.id, p.slug, p.title, p.description,
    p.price_cents, p.compare_at_cents, p.currency,
    p.color_name, p.color_hex, p.width_cm,
    p.stock, p.featured, p.status, p.position,
    p.created_at,
    c.slug as category_slug,
    c.name as category_name,
    coalesce(
      (select array_agg(i.url order by i.position, i.created_at)
         from public.product_images i
        where i.product_id = p.id),
      '{}'::text[]
    ) as images
  from public.products p
  join public.categories c on c.id = p.category_id;

grant select on public.products_public to anon, authenticated;
