-- =============================================================================
-- 0006_rpc_checkout.sql
-- FEATURE: The entire order write path, plus the guest's read-back path and
--          the three admin order operations (status, cancellation with
--          restock, payment status). Nothing else may write an order.
--
-- SAFE TO RE-RUN: yes — every function uses CREATE OR REPLACE, and the grants
--          are re-applied each time.
--
-- THE SPLIT RULE used throughout this schema:
--   * If an invariant is expressible as a CHECK on a single row, the admin
--     writes the table directly through an is_admin() policy (products,
--     categories, content_blocks, site_settings, media_assets). Those admin
--     screens are then ordinary PostgREST calls with almost no server code.
--   * If the invariant spans rows or tables — order placement, stock
--     decrement, status transitions — it goes through a SECURITY DEFINER
--     function. The things that can lose money are funnelled through
--     validated code.
--
-- NOTE: a SECURITY DEFINER function has already left RLS behind, so each one
--       that is not meant for the public re-checks is_admin() as its first
--       statement. The function body IS the policy.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Shipping: one implementation, shared by the bag drawer and by place_order,
-- so the total quoted and the total charged are provably the same computation.
-- Duplicating this rule in TypeScript is how stores end up charging a number
-- they never displayed.
--
-- It reads the rate through setting_int_private() rather than the public
-- accessor so the rule stays authoritative even if shipping.flat_rate_cents is
-- ever flipped to is_public = false: the number charged must not depend on who
-- is asking.
-- -----------------------------------------------------------------------------
create or replace function public.calc_shipping_cents(p_subtotal_cents integer)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when p_subtotal_cents is null or p_subtotal_cents <= 0 then 0
    when p_subtotal_cents >= public.setting_int_private('shipping.free_threshold_cents', 500000) then 0
    else public.setting_int_private('shipping.flat_rate_cents', 35000)
  end;
$$;

revoke execute on function public.calc_shipping_cents(integer) from public;
grant  execute on function public.calc_shipping_cents(integer) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- price_cart — prices a browser cart for the bag drawer and checkout summary.
-- Read-only, and deliberately SECURITY INVOKER: it touches only publicly
-- readable products, so it needs no elevated privilege, and running as the
-- caller means the products RLS policy still applies — a draft product simply
-- drops out of the quote instead of being priced.
-- Any price the client sends in p_items is ignored.
-- It reads checkout.max_lines / max_line_quantity through the PUBLIC setting
-- accessors, which is correct: as SECURITY INVOKER it may not call the private
-- ones, and both keys are seeded is_public = true precisely so the storefront
-- can see the same limits the server enforces.
-- -----------------------------------------------------------------------------
create or replace function public.price_cart(p_items jsonb)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_lines     jsonb := '[]'::jsonb;
  v_issues    jsonb := '[]'::jsonb;
  v_subtotal  integer := 0;
  v_shipping  integer;
  v_max_lines integer := public.setting_int('checkout.max_lines', 20);
  v_max_qty   integer := public.setting_int('checkout.max_line_quantity', 10);
  r           record;
  v_p         record;
  v_qty       integer;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    return jsonb_build_object('lines', v_lines, 'issues', v_issues,
                              'subtotal_cents', 0, 'shipping_cents', 0,
                              'total_cents', 0, 'currency', 'LKR');
  end if;

  if jsonb_array_length(p_items) > v_max_lines then
    raise exception 'A cart may hold at most % different products', v_max_lines
      using errcode = '23514';
  end if;

  for r in
    select (e->>'product_id')::uuid as product_id,
           sum(greatest(1, coalesce((e->>'quantity')::int, 1)))::int as quantity
      from jsonb_array_elements(p_items) e
     where e ? 'product_id' and (e->>'product_id') is not null
     group by 1
     order by 1
  loop
    v_qty := least(r.quantity, v_max_qty);

    select p.id, p.slug, p.title, p.price_cents, p.compare_at_cents, p.stock,
           p.color_name, p.width_cm,
           (select i.url from public.product_images i
             where i.product_id = p.id order by i.position, i.created_at limit 1) as image_url
      into v_p
      from public.products p
     where p.id = r.product_id and p.status = 'active';

    if not found then
      v_issues := v_issues || jsonb_build_object(
        'product_id', r.product_id, 'reason', 'unavailable');
      continue;
    end if;

    if v_p.stock < v_qty then
      v_issues := v_issues || jsonb_build_object(
        'product_id', v_p.id, 'reason', 'insufficient_stock', 'available', v_p.stock);
      v_qty := v_p.stock;
      if v_qty <= 0 then
        continue;
      end if;
    end if;

    v_subtotal := v_subtotal + (v_p.price_cents * v_qty);
    v_lines := v_lines || jsonb_build_object(
      'product_id',       v_p.id,
      'slug',             v_p.slug,
      'title',            v_p.title,
      'image_url',        v_p.image_url,
      'color_name',       v_p.color_name,
      'unit_price_cents', v_p.price_cents,
      'compare_at_cents', v_p.compare_at_cents,
      'quantity',         v_qty,
      'line_total_cents', v_p.price_cents * v_qty,
      'max_quantity',     least(v_p.stock, v_max_qty));
  end loop;

  v_shipping := public.calc_shipping_cents(v_subtotal);

  return jsonb_build_object(
    'lines',          v_lines,
    'issues',         v_issues,
    'currency',       'LKR',
    'subtotal_cents', v_subtotal,
    'shipping_cents', v_shipping,
    'total_cents',    v_subtotal + v_shipping);
end;
$$;

revoke execute on function public.price_cart(jsonb) from public;
grant  execute on function public.price_cart(jsonb) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Internal helpers for the one-time order token.
-- Two gen_random_uuid() values give a 64-character hex token with ~244 bits of
-- entropy, and sha256() is core Postgres — so neither depends on which schema
-- pgcrypto happens to be installed into.
-- -----------------------------------------------------------------------------
create or replace function public.new_order_token()
returns text
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  select replace(gen_random_uuid()::text, '-', '')
      || replace(gen_random_uuid()::text, '-', '');
$$;

create or replace function public.hash_order_token(p_token text)
returns bytea
language sql
immutable
security definer
set search_path = public, pg_temp
as $$
  select sha256(convert_to(p_token, 'UTF8'));
$$;

revoke execute on function public.new_order_token()        from public, anon, authenticated;
revoke execute on function public.hash_order_token(text)   from public, anon, authenticated;

-- The caller hint the throttle buckets on, taken from the request PostgREST is
-- actually serving rather than from a function argument. Still only a hint —
-- x-forwarded-for is client-settable and, when the Next.js route calls on the
-- shopper's behalf, the address seen here may be the route's own — which is
-- why place_order also buckets on the (validated) customer email.
create or replace function public.request_ip_hint()
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_headers json;
begin
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    return null;          -- not running under PostgREST, or a malformed header
  end;
  return nullif(btrim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)), '');
end;
$$;

revoke execute on function public.request_ip_hint() from public, anon, authenticated;

-- Best-effort throttling. Buckets are salted hashes, never raw identifiers.
create or replace function public.throttle_bucket(p_value text)
returns bytea
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select sha256(convert_to(
    public.setting_text_private('integrations.throttle_salt', 'franley-default-salt')
    || '|' || coalesce(p_value, 'unknown'), 'UTF8'));
$$;

revoke execute on function public.throttle_bucket(text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- place_order — the ONE door into the orders tables.
--
-- The signature is the security model: there is no price, total, status,
-- order_number or token parameter, so none can be supplied. unit_price_cents
-- is read only from public.products under SELECT ... FOR UPDATE, with rows
-- locked in id order so concurrent checkouts cannot deadlock. The client's
-- cart contributes product_id and quantity, and nothing else.
-- -----------------------------------------------------------------------------
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
  r           record;
  v_email     text;
begin
  -- 0. Owner-operable kill switch.
  if not public.setting_bool_private('checkout.enabled', true) then
    raise exception 'Checkout is temporarily closed. Please try again shortly.'
      using errcode = '23514';
  end if;

  -- 1. Contact and address are validated here as well as by table CHECKs, so
  --    the caller gets a readable message instead of a constraint name.
  --    This runs BEFORE the idempotency lookup because the email it produces is
  --    what scopes that lookup — see step 2.
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

  -- 2. Idempotency: a retried submit returns the existing order rather than
  --    charging and de-stocking twice. No new token is minted.
  --
  --    SCOPED TO THE CALLER'S OWN EMAIL, and that is a security property, not a
  --    refinement. The key is whatever the client put in the x-idempotency-key
  --    header, constrained only to 8-64 characters, and this function is
  --    SECURITY DEFINER: an unscoped lookup would read straight past the
  --    restrictive orders_admin_only policy and turn a guessed key ('order123')
  --    into an oracle returning a stranger's order number and totals. With the
  --    email in the predicate a guess only ever matches the guesser's own
  --    order, and a wrong guess simply places a new one.
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

    -- The key is taken but not by this shopper. The unique index would reject
    -- the insert anyway, with a constraint name the route cannot show anyone;
    -- this raises the shopper-safe code instead. It reveals only that a key is
    -- in use, never whose or what it bought.
    if exists (select 1 from public.orders where idempotency_key = p_idempotency_key) then
      raise exception 'This submission could not be matched to your details. Please refresh the checkout and try again.'
        using errcode = '22023';
    end if;
  end if;

  -- 3. Best-effort throttle. Telemetry and a speed bump, not a control — see
  --    the risks section of supabase/README.md.
  --
  --    TWO BUCKETS, because p_ip_hint is an ordinary argument under the
  --    caller's control and EXECUTE on this function is granted to anon: a
  --    fresh random hint per call would land in a fresh bucket every time and
  --    the limit would never be reached. The email bucket is unconditional, so
  --    evading the counter now costs a new email address per attempt as well.
  --    (The definitive control is to stop granting anon EXECUTE here and put
  --    this behind a server-side role; that is a deployment decision, recorded
  --    in supabase/README.md, not something SQL can assert.)
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

  -- The address bucket is skipped entirely when there is no hint: bucketing
  -- every hintless caller together would be one global counter, and eight
  -- checkouts an hour across the whole store is an outage, not a rate limit.
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

  -- 5. Reprice server-side. Rows are locked in id order to make deadlock
  --    between two simultaneous checkouts impossible.
  for r in
    select (e->>'product_id')::uuid as product_id,
           sum(greatest(1, coalesce((e->>'quantity')::int, 1)))::int as quantity
      from jsonb_array_elements(p_items) e
     where e ? 'product_id' and (e->>'product_id') is not null
     group by 1
     order by 1
  loop
    if r.quantity < 1 or r.quantity > v_max_qty then
      raise exception 'Quantity must be between 1 and % per product', v_max_qty
        using errcode = '23514';
    end if;

    select p.id, p.slug, p.title, p.price_cents, p.stock, p.color_name, p.width_cm,
           (select i.url from public.product_images i
             where i.product_id = p.id order by i.position, i.created_at limit 1) as image_url
      into v_p
      from public.products p
     where p.id = r.product_id and p.status = 'active'
     for update;

    if not found then
      raise exception 'One of the items in your bag is no longer available'
        using errcode = '23514';
    end if;
    if v_p.stock < r.quantity then
      raise exception 'Only % left of %', v_p.stock, v_p.title using errcode = '23514';
    end if;

    update public.products
       set stock = stock - r.quantity
     where id = v_p.id;

    v_subtotal := v_subtotal + (v_p.price_cents * r.quantity);

    v_lines := v_lines || jsonb_build_object(
      'product_id',       v_p.id,
      'product_slug',     v_p.slug,
      'product_title',    v_p.title,
      'variant_label',    nullif(btrim(concat_ws(' - ', v_p.color_name,
                            case when v_p.width_cm is null then null
                                 else trim(trailing '.' from trim(trailing '0' from v_p.width_cm::text)) || 'cm' end)), ''),
      'image_url',        v_p.image_url,
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
    order_id, product_id, product_slug, product_title, variant_label,
    image_url, unit_price_cents, quantity)
  select v_order_id,
         (l->>'product_id')::uuid,
         l->>'product_slug',
         l->>'product_title',
         l->>'variant_label',
         l->>'image_url',
         (l->>'unit_price_cents')::integer,
         (l->>'quantity')::integer
    from jsonb_array_elements(v_lines) l;

  -- The plaintext token exists here and nowhere else. Show it on the
  -- confirmation page, set it in an httpOnly cookie, and email it.
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

revoke execute on function public.place_order(jsonb, jsonb, jsonb, public.payment_method, text, text, text) from public;
grant  execute on function public.place_order(jsonb, jsonb, jsonb, public.payment_method, text, text, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- get_order_by_token — "track my order" for a guest with no account.
--
-- The 244-bit token is the SOLE credential. Lookup by order_number + email is
-- deliberately NOT offered: order numbers are sequential and emails are
-- guessable, so that pair would be an enumeration oracle over every customer's
-- address and phone number. The order number stays a human reference, never an
-- authenticator.
-- -----------------------------------------------------------------------------
create or replace function public.get_order_by_token(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_o      public.orders%rowtype;
  v_items  jsonb;
  v_bucket bytea;
  v_hits   integer;
  v_ip     text;
  v_limit  integer := public.setting_int_private('checkout.lookup_limit_per_hour', 600);
begin
  -- Shape first: a malformed token is rejected before anything is written.
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid order link' using errcode = '22023';
  end if;

  -- Throttle on the CALLER, never on the token being tried. Bucketing by the
  -- token — as this did — partitions the counter per secret: someone walking
  -- random tokens lands in a fresh bucket with zero prior hits every single
  -- time, so the limit cannot fire against the one attack it exists to slow,
  -- while a customer refreshing their own order page is the only party it can
  -- ever stop.
  --
  -- Its remaining limits, stated plainly so nobody mistakes this for a control:
  -- the caller hint is a request header and therefore soft, and a lookup that
  -- fails RAISES, which aborts the transaction and rolls back the counter row
  -- inserted just below — so only successful lookups accumulate. Rate limiting
  -- failed lookups has to happen at the edge (the Next.js route or the platform
  -- WAF), where a failure can be recorded without a transaction to roll back.
  --
  -- The limit is deliberately loose (checkout.lookup_limit_per_hour, default
  -- 600) because when the order page renders server-side EVERY shopper arrives
  -- from the same address, so this is one shared counter and a tight number
  -- would be a store-wide outage rather than a rate limit. A caller hitting
  -- PostgREST directly does get its own bucket, which is the case worth
  -- counting.
  v_ip     := coalesce(public.request_ip_hint(), 'unknown');
  v_bucket := public.throttle_bucket('lookup|' || v_ip);

  delete from public.checkout_throttle where created_at < now() - interval '2 days';

  select count(*) into v_hits
    from public.checkout_throttle
   where kind = 'order_lookup' and bucket = v_bucket
     and created_at > now() - interval '1 hour';
  if v_hits >= v_limit then
    raise exception 'Too many lookups. Please try again later.' using errcode = '53400';
  end if;
  insert into public.checkout_throttle (bucket, kind) values (v_bucket, 'order_lookup');

  -- One probe of the unique index on a hash: uniform cost, so no timing signal.
  select * into v_o from public.orders
   where access_token_hash = public.hash_order_token(p_token);

  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'product_slug',     i.product_slug,
           'product_title',    i.product_title,
           'variant_label',    i.variant_label,
           'image_url',        i.image_url,
           'unit_price_cents', i.unit_price_cents,
           'quantity',         i.quantity,
           'line_total_cents', i.line_total_cents) order by i.created_at), '[]'::jsonb)
    into v_items
    from public.order_items i
   where i.order_id = v_o.id;

  -- A hand-enumerated column list, never SELECT *: admin_note, idempotency_key
  -- and access_token_hash are omitted, and a future ALTER TABLE cannot start
  -- leaking a new column by default.
  return jsonb_build_object(
    'order_number',    v_o.order_number,
    'status',          v_o.status,
    'payment_status',  v_o.payment_status,
    'payment_method',  v_o.payment_method,
    'currency',        v_o.currency,
    'subtotal_cents',  v_o.subtotal_cents,
    'shipping_cents',  v_o.shipping_cents,
    'discount_cents',  v_o.discount_cents,
    'total_cents',     v_o.total_cents,
    'customer_name',   v_o.customer_name,
    'customer_email',  v_o.customer_email,
    'customer_phone',  v_o.customer_phone,
    'shipping_line1',  v_o.shipping_line1,
    'shipping_line2',  v_o.shipping_line2,
    'shipping_city',   v_o.shipping_city,
    'shipping_district', v_o.shipping_district,
    'shipping_postal_code', v_o.shipping_postal_code,
    'shipping_country',  v_o.shipping_country,
    'customer_note',   v_o.customer_note,
    'tracking_number', v_o.tracking_number,
    'created_at',      v_o.created_at,
    'confirmed_at',    v_o.confirmed_at,
    'shipped_at',      v_o.shipped_at,
    'delivered_at',    v_o.delivered_at,
    'cancelled_at',    v_o.cancelled_at,
    'items',           v_items);
end;
$$;

revoke execute on function public.get_order_by_token(text) from public;
grant  execute on function public.get_order_by_token(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- admin_update_order_status — the only way an order's status moves.
-- authenticated has UPDATE only on (admin_note, tracking_number), so this
-- function exists precisely so no wider grant is ever needed.
--
-- CANCELLATION IS NOT ONE OF THE MOVES IT PERFORMS. It used to be: the
-- transition table allowed pending/confirmed/packed/shipped -> cancelled, but
-- the UPDATE below only writes status and timestamps, so the reserved units
-- were never returned to products.stock — and because admin_cancel_order
-- short-circuits on an order that is already cancelled, the restock could not
-- be run afterwards either. Every order cancelled through this door silently
-- destroyed inventory. Cancellation now DELEGATES to admin_cancel_order, so
-- exactly one code path owns the restock decision.
-- -----------------------------------------------------------------------------
create or replace function public.admin_update_order_status(
  p_order_id uuid,
  p_status   public.order_status,
  p_note     text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_o public.orders%rowtype;
  v_allowed boolean;
begin
  -- A SECURITY DEFINER function has already left RLS behind, so it must
  -- re-check authorisation itself.
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- Cancellation has a side effect this function does not implement (returning
  -- stock), so it is handed to the function that does. p_restock defaults to
  -- true there, which is the safe default: an order that never shipped has its
  -- units back on the shelf.
  if p_status = 'cancelled' then
    return public.admin_cancel_order(p_order_id, true, p_note);
  end if;

  select * into v_o from public.orders where id = p_order_id;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  if v_o.status = p_status then
    return jsonb_build_object('order_id', v_o.id, 'status', v_o.status, 'changed', false);
  end if;

  -- 'cancelled' is absent from every row: it is handled above by delegation.
  v_allowed := case v_o.status
    when 'pending'   then p_status in ('confirmed')
    when 'confirmed' then p_status in ('packed','shipped')
    when 'packed'    then p_status in ('shipped')
    when 'shipped'   then p_status in ('delivered')
    when 'delivered' then p_status in ('refunded')
    when 'cancelled' then false          -- terminal; use a new order instead
    when 'refunded'  then false          -- terminal
    else false
  end;

  if not v_allowed then
    raise exception 'Cannot move an order from % to %', v_o.status, p_status
      using errcode = '23514';
  end if;

  update public.orders
     set status       = p_status,
         confirmed_at = case when p_status = 'confirmed' then now() else confirmed_at end,
         shipped_at   = case when p_status = 'shipped'   then now() else shipped_at   end,
         delivered_at = case when p_status = 'delivered' then now() else delivered_at end,
         payment_status = case
                            when p_status = 'delivered' and payment_method = 'cod'
                              then 'paid'::public.payment_status
                            -- Money that was collected and then given back is
                            -- 'refunded', not still 'paid'. Anything not yet
                            -- collected stays where it is.
                            when p_status = 'refunded' and payment_status = 'paid'
                              then 'refunded'::public.payment_status
                            else payment_status
                          end
   where id = p_order_id;

  if p_note is not null then
    insert into public.order_events (order_id, from_status, to_status, actor_kind, actor_user_id, note)
    values (p_order_id, v_o.status, p_status, 'admin', auth.uid(), left(p_note, 500));
  end if;

  return jsonb_build_object('order_id', p_order_id, 'status', p_status, 'changed', true);
end;
$$;

revoke execute on function public.admin_update_order_status(uuid, public.order_status, text) from public, anon;
grant  execute on function public.admin_update_order_status(uuid, public.order_status, text) to authenticated;

-- -----------------------------------------------------------------------------
-- admin_cancel_order — cancels and, by default, restocks. The mitigation for
-- fake-order stock drain. Never deletes: cancellation is a status, so the
-- financial record and its audit trail survive.
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

  -- Idempotent: cancelling twice is a no-op and does not restock twice. The
  -- guard is the current status, not a flag the caller supplies.
  if v_o.status = 'cancelled' then
    return jsonb_build_object('order_id', v_o.id, 'status', 'cancelled', 'changed', false);
  end if;

  -- Goods that have already reached the customer are refunded, not cancelled.
  -- Allowing this would silently restock stock that is not physically back.
  if v_o.status in ('delivered', 'refunded') then
    raise exception 'Order % is already %; use a refund rather than a cancellation.',
      v_o.order_number, v_o.status using errcode = '23514';
  end if;

  if p_restock then
    -- Lock the affected products in ascending id order FIRST. place_order takes
    -- its locks in that same order (the `order by 1` feeding its SELECT ... FOR
    -- UPDATE), and the UPDATE below would otherwise take them in whatever order
    -- the planner produced — two paths disagreeing on lock order is exactly how
    -- a cancellation and a concurrent checkout over the same two products
    -- deadlock (40P01), aborting one of them for no reason a shopper or an
    -- admin could understand.
    perform 1
       from public.products
      where id in (select distinct product_id
                     from public.order_items
                    where order_id = p_order_id and product_id is not null)
      order by id
        for update;

    update public.products p
       set stock = p.stock + i.qty
      from (select product_id, sum(quantity)::int as qty
              from public.order_items
             where order_id = p_order_id and product_id is not null
             group by product_id) i
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

-- -----------------------------------------------------------------------------
-- admin_set_payment_status — the missing half of the money record.
--
-- Before this existed, orders.payment_status had exactly ONE write path in the
-- whole schema: the CASE inside admin_update_order_status, which only ever set
-- 'paid', and only for a COD order reaching 'delivered'. authenticated holds
-- UPDATE on (admin_note, tracking_number) and nothing else, and anon holds
-- nothing at all — so a bank_transfer order whose slip had arrived, or a card
-- order, could never be recorded as paid by any means short of the SQL editor,
-- and 'pending' and 'failed' were unreachable members of the enum.
--
-- Payment moves are validated the same way status moves are, and audited the
-- same way: the write to orders.payment_status fires trg_orders_log_event,
-- which appends the 'payment: x -> y' row by itself.
-- -----------------------------------------------------------------------------
create or replace function public.admin_set_payment_status(
  p_order_id uuid,
  p_status   public.payment_status,
  p_note     text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_o       public.orders%rowtype;
  v_allowed boolean;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into v_o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  if v_o.payment_status = p_status then
    return jsonb_build_object('order_id', v_o.id,
                              'payment_status', v_o.payment_status, 'changed', false);
  end if;

  -- Money is allowed to move forward, and back exactly once (paid -> refunded).
  -- 'unpaid' is reachable again from the two non-terminal states so a mistaken
  -- click is correctable; from 'paid' or 'refunded' it is not, because that
  -- would erase a collection that happened.
  v_allowed := case v_o.payment_status
    when 'unpaid'   then p_status in ('pending','paid','failed')
    when 'pending'  then p_status in ('paid','failed','unpaid')
    when 'failed'   then p_status in ('pending','paid','unpaid')
    when 'paid'     then p_status in ('refunded')
    when 'refunded' then false          -- terminal
    else false
  end;

  if not v_allowed then
    raise exception 'Cannot move payment from % to %', v_o.payment_status, p_status
      using errcode = '23514';
  end if;

  update public.orders
     set payment_status = p_status
   where id = p_order_id;

  if p_note is not null then
    insert into public.order_events (order_id, from_status, to_status, actor_kind, actor_user_id, note)
    values (p_order_id, v_o.status, v_o.status, 'admin', auth.uid(), left(p_note, 500));
  end if;

  return jsonb_build_object('order_id', p_order_id, 'payment_status', p_status, 'changed', true);
end;
$$;

revoke execute on function public.admin_set_payment_status(uuid, public.payment_status, text) from public, anon;
grant  execute on function public.admin_set_payment_status(uuid, public.payment_status, text) to authenticated;
