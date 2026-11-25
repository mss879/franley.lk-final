-- =============================================================================
-- 0018_product_colours.sql
-- FEATURE: Colour options on a product, each with its own photographs and its
--          own stock.
--
--          A tie sold in several colours is ONE product now, not one listing
--          per colour. Its general photographs (the whole range together) are
--          the product's images with no colour; each colour then has its own
--          photographs, shown on the product page once a shopper picks it.
--
-- SAFE TO RE-RUN: yes. Tables, columns and indexes are IF NOT EXISTS, policies
--          and triggers are dropped and recreated, functions and the two views
--          are replaced.
--
-- HOW STOCK WORKS
--   * product_colors.stock is the real count for a product that has colours.
--   * products.stock is kept equal to the SUM of its colours by triggers, so
--     every listing, badge and "sold out" check that reads products.stock keeps
--     working unchanged. A product with no colours keeps its own stock exactly
--     as before.
--   * place_order takes stock from the colour chosen; admin_cancel_order (the
--     one path every cancellation and release goes through) puts it back there.
--   * order_items.variant_id, reserved in 0005 for exactly this, now records
--     the colour sold, and variant_label carries its name, so the admin,
--     emails and the order page show the colour with no further change.
--
-- RE-RUN 0010_guardrails.sql AFTER THIS FILE.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- product_colors
-- -----------------------------------------------------------------------------
create table if not exists public.product_colors (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 60),
  stock       integer not null default 0 check (stock >= 0),
  position    integer not null default 0 check (position >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.product_colors is
  'Colour options of a product. Each has its own stock and photographs (product_images.color_id).';

create unique index if not exists product_colors_product_name_key
  on public.product_colors (product_id, lower(btrim(name)));
create index if not exists product_colors_product_idx
  on public.product_colors (product_id, position);

drop trigger if exists trg_product_colors_updated_at on public.product_colors;
create trigger trg_product_colors_updated_at
  before update on public.product_colors
  for each row execute function public.set_updated_at();

alter table public.product_colors enable row level security;

drop policy if exists product_colors_public_read  on public.product_colors;
drop policy if exists product_colors_admin_insert on public.product_colors;
drop policy if exists product_colors_admin_update on public.product_colors;
drop policy if exists product_colors_admin_delete on public.product_colors;

-- Same shape as product_images: a colour of an unreleased product stays hidden.
create policy product_colors_public_read on public.product_colors
  for select to anon, authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.products p
       where p.id = product_colors.product_id
         and p.status = 'active'
    )
  );

create policy product_colors_admin_insert on public.product_colors
  for insert to authenticated
  with check ((select public.is_admin()));

create policy product_colors_admin_update on public.product_colors
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy product_colors_admin_delete on public.product_colors
  for delete to authenticated
  using ((select public.is_admin()));

revoke all on public.product_colors from anon, authenticated, public;
grant select on public.product_colors to anon;
grant select, insert, update, delete on public.product_colors to authenticated;

-- -----------------------------------------------------------------------------
-- product_images.color_id — which colour a photograph shows (NULL = general)
-- -----------------------------------------------------------------------------
-- Deleting a colour keeps its photographs as general ones rather than leaving
-- rows pointing nowhere; the admin can delete them from the product page.
alter table public.product_images
  add column if not exists color_id uuid references public.product_colors(id) on delete set null;

create index if not exists product_images_color_idx
  on public.product_images (color_id, position) where color_id is not null;

-- A photograph may only be tied to a colour of its own product.
create or replace function public.tg_product_images_color_check()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.color_id is not null and not exists (
    select 1 from public.product_colors c
     where c.id = new.color_id and c.product_id = new.product_id
  ) then
    raise exception 'That colour belongs to a different product' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_product_images_color_check on public.product_images;
create trigger trg_product_images_color_check
  before insert or update of color_id, product_id on public.product_images
  for each row execute function public.tg_product_images_color_check();

-- -----------------------------------------------------------------------------
-- order_items.variant_id -> product_colors
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'order_items_variant_id_fkey') then
    alter table public.order_items
      add constraint order_items_variant_id_fkey
      foreign key (variant_id) references public.product_colors(id) on delete set null;
  end if;
end
$$;

comment on column public.order_items.variant_id is
  'The colour sold (product_colors.id), NULL for a product without colours. variant_label holds its name as sold.';

-- -----------------------------------------------------------------------------
-- products.stock = sum of its colours
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER so the sum is written however the colour row changed (an
-- admin edit, place_order, a cancellation). It touches nothing but the stock
-- of the one product whose colour changed.
create or replace function public.tg_product_colors_sync_stock()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product uuid := coalesce(new.product_id, old.product_id);
begin
  -- With its last colour gone the product keeps whatever stock it had; the
  -- admin sets it from then on, as for any product without colours.
  if exists (select 1 from public.product_colors where product_id = v_product) then
    update public.products
       set stock = (select coalesce(sum(stock), 0)::int
                      from public.product_colors where product_id = v_product)
     where id = v_product;
  end if;

  if tg_op = 'UPDATE' and old.product_id is distinct from new.product_id then
    if exists (select 1 from public.product_colors where product_id = old.product_id) then
      update public.products
         set stock = (select coalesce(sum(stock), 0)::int
                        from public.product_colors where product_id = old.product_id)
       where id = old.product_id;
    end if;
  end if;

  return null;
end;
$$;

revoke execute on function public.tg_product_colors_sync_stock() from public, anon, authenticated;

drop trigger if exists trg_product_colors_sync_stock on public.product_colors;
create trigger trg_product_colors_sync_stock
  after insert or update of stock, product_id or delete on public.product_colors
  for each row execute function public.tg_product_colors_sync_stock();

-- Any direct write to a coloured product's stock (the admin form, an old
-- restock path) is corrected back to the sum, so the two can never drift.
create or replace function public.tg_products_stock_from_colors()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.product_colors where product_id = new.id) then
    new.stock := (select coalesce(sum(stock), 0)::int
                    from public.product_colors where product_id = new.id);
  end if;
  return new;
end;
$$;

revoke execute on function public.tg_products_stock_from_colors() from public, anon, authenticated;

drop trigger if exists trg_products_stock_from_colors on public.products;
create trigger trg_products_stock_from_colors
  before update of stock on public.products
  for each row execute function public.tg_products_stock_from_colors();

-- -----------------------------------------------------------------------------
-- Storefront views
-- -----------------------------------------------------------------------------
-- `images` is now the GENERAL photographs only; colour photographs travel in
-- the new `colors` column. CREATE OR REPLACE keeps every existing column in
-- place and appends `colors` at the end.
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
        where i.product_id = p.id and i.color_id is null),
      '{}'::text[]
    ) as images,
    coalesce(
      (select jsonb_agg(
                jsonb_build_object(
                  'id',     pc.id,
                  'name',   pc.name,
                  'stock',  pc.stock,
                  'images', coalesce(
                    (select to_jsonb(array_agg(i.url order by i.position, i.created_at))
                       from public.product_images i
                      where i.color_id = pc.id),
                    '[]'::jsonb))
                order by pc.position, pc.created_at)
         from public.product_colors pc
        where pc.product_id = p.id),
      '[]'::jsonb
    ) as colors
  from public.products p
  join public.categories c on c.id = p.category_id;

grant select on public.products_public to anon, authenticated;

-- collection_products_public selects p.* and so froze the old column list
-- when 0013 created it. Rebuilt here so collection pages get `colors` too
-- (identical to 0013 otherwise).
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
  'One row per (collection, product) with the full products_public record. Filter on collection_slug, order by item_position. Rebuild after any change to products_public (last: 0018).';

grant select on public.collection_products_public to anon, authenticated;

-- -----------------------------------------------------------------------------
-- place_order — as in 0006, except that a bag line may name a colour
-- -----------------------------------------------------------------------------
-- p_items elements: { product_id, quantity, color_id? }. Lines group by
-- (product, colour), so two colours of one tie are two lines. A product that
-- has colours must be ordered in one of them; its stock is taken from that
-- colour (and products.stock follows through the trigger above).
create or replace function public.place_order(
  p_items           jsonb,
  p_customer        jsonb,
  p_shipping        jsonb,
  p_payment_method  public.payment_method default 'cod',
  p_note            text default null,
  p_idempotency_key text default null,
  p_ip_hint         text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_max_lines integer := public.setting_int_private('checkout.max_lines', 20);
  v_max_qty   integer := public.setting_int_private('checkout.max_line_quantity', 10);
  v_rate      integer := public.setting_int_private('checkout.rate_limit_per_hour', 8);
  v_lines     jsonb := '[]'::jsonb;
  v_subtotal  integer := 0;
  v_shipping  integer;
  v_token     text;
  v_order_id  uuid;
  v_number    text;
  v_bucket    bytea;
  v_hits      integer;
  v_ip        text;
  v_existing  public.orders%rowtype;
  v_p         record;
  v_c         record;
  r           record;
  v_email     text;
  v_width     text;
  v_image     text;
  v_colour    text;
begin
  -- 0. Owner-operable kill switch.
  if not public.setting_bool_private('checkout.enabled', true) then
    raise exception 'Checkout is temporarily closed. Please try again shortly.'
      using errcode = '23514';
  end if;

  -- 1. Contact and address (see 0006 for why this precedes idempotency).
  v_email := lower(btrim(coalesce(p_customer->>'email', '')));
  if v_email = '' or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'A valid email address is required' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_customer->>'name', ''))) < 2 then
    raise exception 'A name is required' using errcode = '22023';
  end if;
  if coalesce(p_customer->>'phone', '') !~ '^[0-9+][0-9 +()-]{6,19}$' then
    raise exception 'A valid phone number is required' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_shipping->>'line1', ''))) < 3
     or length(btrim(coalesce(p_shipping->>'city', ''))) < 2 then
    raise exception 'A delivery address and city are required' using errcode = '22023';
  end if;

  -- 2. Idempotency, scoped to the caller's own email (see 0006).
  if p_idempotency_key is not null then
    select * into v_existing from public.orders
     where idempotency_key = p_idempotency_key
       and lower(customer_email) = v_email;
    if found then
      return jsonb_build_object(
        'order_id',       v_existing.id,
        'order_number',   v_existing.order_number,
        'access_token',   null,
        'duplicate',      true,
        'subtotal_cents', v_existing.subtotal_cents,
        'shipping_cents', v_existing.shipping_cents,
        'total_cents',    v_existing.total_cents,
        'currency',       v_existing.currency);
    end if;

    if exists (select 1 from public.orders where idempotency_key = p_idempotency_key) then
      raise exception 'This submission could not be matched to your details. Please refresh the checkout and try again.'
        using errcode = '22023';
    end if;
  end if;

  -- 3. Best-effort throttle: an email bucket always, an address bucket when
  --    there is a hint (see 0006).
  delete from public.checkout_throttle where created_at < now() - interval '2 days';

  v_bucket := public.throttle_bucket('email|' || v_email);
  select count(*) into v_hits
    from public.checkout_throttle
   where kind = 'place_order' and bucket = v_bucket
     and created_at > now() - interval '1 hour';
  if v_hits >= v_rate then
    raise exception 'Too many checkout attempts. Please try again later.'
      using errcode = '53400';
  end if;
  insert into public.checkout_throttle (bucket, kind) values (v_bucket, 'place_order');

  v_ip := coalesce(nullif(btrim(coalesce(p_ip_hint, '')), ''), public.request_ip_hint());
  if v_ip is not null then
    v_bucket := public.throttle_bucket('ip|' || v_ip);
    select count(*) into v_hits
      from public.checkout_throttle
     where kind = 'place_order' and bucket = v_bucket
       and created_at > now() - interval '1 hour';
    if v_hits >= v_rate then
      raise exception 'Too many checkout attempts. Please try again later.'
        using errcode = '53400';
    end if;
    insert into public.checkout_throttle (bucket, kind) values (v_bucket, 'place_order');
  end if;

  -- 4. Cart shape.
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your bag is empty' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > v_max_lines then
    raise exception 'A cart may hold at most % different products', v_max_lines
      using errcode = '23514';
  end if;

  -- 5. Reprice server-side. Products are locked in id order (as in 0006 and
  --    admin_cancel_order), each colour right after its product.
  for r in
    select (e->>'product_id')::uuid as product_id,
           nullif(btrim(coalesce(e->>'color_id', '')), '')::uuid as color_id,
           sum(greatest(1, coalesce((e->>'quantity')::int, 1)))::int as quantity
      from jsonb_array_elements(p_items) e
     where e ? 'product_id' and (e->>'product_id') is not null
     group by 1, 2
     order by 1, 2 nulls first
  loop
    if r.quantity < 1 or r.quantity > v_max_qty then
      raise exception 'Quantity must be between 1 and % per product', v_max_qty
        using errcode = '23514';
    end if;

    select p.id, p.slug, p.title, p.price_cents, p.stock, p.color_name, p.width_cm,
           (select i.url from public.product_images i
             where i.product_id = p.id
             order by (i.color_id is not null), i.position, i.created_at limit 1) as image_url
      into v_p
      from public.products p
     where p.id = r.product_id and p.status = 'active'
     for update;

    if not found then
      raise exception 'One of the items in your bag is no longer available'
        using errcode = '23514';
    end if;

    v_width := case when v_p.width_cm is null then null
                    else trim(trailing '.' from trim(trailing '0' from v_p.width_cm::text)) || 'cm' end;

    if r.color_id is not null then
      select c.id, c.name, c.stock,
             (select i.url from public.product_images i
               where i.color_id = c.id order by i.position, i.created_at limit 1) as image_url
        into v_c
        from public.product_colors c
       where c.id = r.color_id and c.product_id = v_p.id
       for update;

      if not found then
        raise exception 'The colour you chose for % is no longer available. Please choose it again.', v_p.title
          using errcode = '23514';
      end if;
      if v_c.stock < r.quantity then
        raise exception 'Only % left of % in %', v_c.stock, v_p.title, v_c.name using errcode = '23514';
      end if;

      update public.product_colors
         set stock = stock - r.quantity
       where id = v_c.id;

      v_image  := coalesce(v_c.image_url, v_p.image_url);
      v_colour := v_c.name;
    else
      if exists (select 1 from public.product_colors where product_id = v_p.id) then
        raise exception 'Please choose a colour for %', v_p.title using errcode = '23514';
      end if;
      if v_p.stock < r.quantity then
        raise exception 'Only % left of %', v_p.stock, v_p.title using errcode = '23514';
      end if;

      update public.products
         set stock = stock - r.quantity
       where id = v_p.id;

      v_image  := v_p.image_url;
      v_colour := v_p.color_name;
    end if;

    v_subtotal := v_subtotal + (v_p.price_cents * r.quantity);

    v_lines := v_lines || jsonb_build_object(
      'product_id',       v_p.id,
      'variant_id',       r.color_id,
      'product_slug',     v_p.slug,
      'product_title',    v_p.title,
      'variant_label',    left(nullif(btrim(concat_ws(' - ', v_colour, v_width)), ''), 80),
      'image_url',        v_image,
      'unit_price_cents', v_p.price_cents,
      'quantity',         r.quantity);
  end loop;

  if v_subtotal <= 0 then
    raise exception 'Your bag is empty' using errcode = '22023';
  end if;

  v_shipping := public.calc_shipping_cents(v_subtotal);
  v_token    := public.new_order_token();

  -- 6. Write. The deferred constraint trigger from 0005 re-checks at COMMIT
  --    that this subtotal equals the sum of the items inserted below.
  insert into public.orders (
    user_id, status, payment_status, payment_method, currency,
    subtotal_cents, shipping_cents, discount_cents, total_cents,
    customer_name, customer_email, customer_phone,
    shipping_line1, shipping_line2, shipping_city, shipping_district,
    shipping_postal_code, shipping_country,
    customer_note, access_token_hash, idempotency_key
  ) values (
    auth.uid(), 'pending', 'unpaid', p_payment_method, 'LKR',
    v_subtotal, v_shipping, 0, v_subtotal + v_shipping,
    btrim(p_customer->>'name'), v_email, btrim(p_customer->>'phone'),
    btrim(p_shipping->>'line1'), nullif(btrim(coalesce(p_shipping->>'line2','')), ''),
    btrim(p_shipping->>'city'), nullif(btrim(coalesce(p_shipping->>'district','')), ''),
    nullif(btrim(coalesce(p_shipping->>'postal_code','')), ''),
    upper(coalesce(nullif(btrim(coalesce(p_shipping->>'country','')), ''), 'LK')),
    nullif(btrim(coalesce(p_note, '')), ''),
    public.hash_order_token(v_token), p_idempotency_key
  )
  returning id, order_number into v_order_id, v_number;

  insert into public.order_items (
    order_id, product_id, variant_id, product_slug, product_title, variant_label,
    image_url, unit_price_cents, quantity)
  select v_order_id,
         (l->>'product_id')::uuid,
         nullif(l->>'variant_id', '')::uuid,
         l->>'product_slug',
         l->>'product_title',
         l->>'variant_label',
         l->>'image_url',
         (l->>'unit_price_cents')::integer,
         (l->>'quantity')::integer
    from jsonb_array_elements(v_lines) l;

  return jsonb_build_object(
    'order_id',       v_order_id,
    'order_number',   v_number,
    'access_token',   v_token,
    'duplicate',      false,
    'currency',       'LKR',
    'subtotal_cents', v_subtotal,
    'shipping_cents', v_shipping,
    'total_cents',    v_subtotal + v_shipping);
end;
$$;

-- Server only, as 0016 left it.
revoke execute on function public.place_order(jsonb, jsonb, jsonb, public.payment_method, text, text, text) from public, anon, authenticated;
grant  execute on function public.place_order(jsonb, jsonb, jsonb, public.payment_method, text, text, text) to service_role;

-- -----------------------------------------------------------------------------
-- admin_cancel_order — as in 0006, except that a coloured line goes back to
-- its colour's stock
-- -----------------------------------------------------------------------------
create or replace function public.admin_cancel_order(
  p_order_id uuid,
  p_restock  boolean default true,
  p_reason   text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_o public.orders%rowtype;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into v_o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  -- Idempotent: cancelling twice is a no-op and does not restock twice.
  if v_o.status = 'cancelled' then
    return jsonb_build_object('order_id', v_o.id, 'status', 'cancelled', 'changed', false);
  end if;

  if v_o.status in ('delivered', 'refunded') then
    raise exception 'Order % is already %; use a refund rather than a cancellation.',
      v_o.order_number, v_o.status using errcode = '23514';
  end if;

  if p_restock then
    -- Products first, in ascending id order — the order place_order locks
    -- them in — so a cancellation and a checkout cannot deadlock.
    perform 1
       from public.products
      where id in (select distinct product_id
                     from public.order_items
                    where order_id = p_order_id and product_id is not null)
      order by id
        for update;

    -- Lines sold in a colour that still exists go back to that colour; the
    -- trigger then brings products.stock to the new sum.
    update public.product_colors pc
       set stock = pc.stock + i.qty
      from (select variant_id, sum(quantity)::int as qty
              from public.order_items
             where order_id = p_order_id and variant_id is not null
             group by variant_id) i
     where pc.id = i.variant_id;

    -- Everything else goes back to the product, as before.
    update public.products p
       set stock = p.stock + i.qty
      from (select oi.product_id, sum(oi.quantity)::int as qty
              from public.order_items oi
             where oi.order_id = p_order_id
               and oi.product_id is not null
               and (oi.variant_id is null
                    or not exists (select 1 from public.product_colors c where c.id = oi.variant_id))
             group by oi.product_id) i
     where p.id = i.product_id;
  end if;

  update public.orders
     set status = 'cancelled', cancelled_at = now()
   where id = p_order_id;

  insert into public.order_events (order_id, from_status, to_status, actor_kind, actor_user_id, note)
  values (p_order_id, v_o.status, 'cancelled', 'admin', auth.uid(),
          left(coalesce(p_reason, 'Cancelled by admin'), 500));

  return jsonb_build_object('order_id', p_order_id, 'status', 'cancelled',
                            'changed', true, 'restocked', p_restock);
end;
$$;

revoke execute on function public.admin_cancel_order(uuid, boolean, text) from public, anon;
grant  execute on function public.admin_cancel_order(uuid, boolean, text) to authenticated;

do $$
begin
  raise notice '0018 applied: products can have colours, each with its own photographs and stock.';
end
$$;
