-- =============================================================================
-- 0014_customers.sql
-- FEATURE: Customers. One row per email address that has ever placed an
--          order, with contact details, order count, money actually collected
--          and an admin-only note — the "who has bought from us" screen.
--
-- SAFE TO RE-RUN: yes. The table is IF NOT EXISTS, the column on orders is
--          ADD COLUMN IF NOT EXISTS, functions are CREATE OR REPLACE with their
--          grants re-applied, policies and triggers are dropped before being
--          created, and the backfill is ON CONFLICT DO NOTHING plus an UPDATE
--          that only touches orders not yet linked.
--
-- RE-RUN THIS FILE AFTER ANY RE-RUN OF 0006. place_order is redefined below
--          (same signature, body copied from 0006 with three marked changes);
--          running 0006 again would put the old body back and new orders
--          would stop being linked to a customer.
--
-- THERE ARE STILL NO CUSTOMER ACCOUNTS. A customers row is an admin-side
--   aggregate over orders, keyed by lowercased email. Nobody logs in as a
--   customer, no shopper can read or write this table, and the guest order
--   token from 0006 remains the only way a shopper sees their own order.
--
-- HOW THE NUMBERS STAY RIGHT: orders_count / total_spent_cents / first and
--   last_order_at are never written by application code. An AFTER trigger on
--   orders recomputes them from the linked orders whenever status,
--   payment_status or customer_id changes, so every write path — place_order,
--   the admin RPCs, record_gateway_payment, the stale-card release in 0015 —
--   keeps them correct without knowing this table exists.
--     orders_count      orders not cancelled and not refunded
--     total_spent_cents sum(total_cents) where payment_status = 'paid' and the
--                       order is not cancelled/refunded — money in hand, not
--                       money promised. A COD order counts from delivery.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- customers
-- -----------------------------------------------------------------------------
create table if not exists public.customers (
  id                uuid primary key default gen_random_uuid(),
  -- Stored lowercased, and the CHECK makes that a property of the table rather
  -- than a habit of the writer: two spellings of one address are one customer.
  email             text not null unique
                      check (email = lower(email)
                             and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
                             and length(email) <= 254),
  name              text not null check (length(btrim(name)) between 2 and 120),
  phone             text check (phone is null or phone ~ '^[0-9+][0-9 +()-]{6,19}$'),
  first_order_at    timestamptz,
  last_order_at     timestamptz,
  orders_count      integer not null default 0 check (orders_count >= 0),
  total_spent_cents bigint  not null default 0 check (total_spent_cents >= 0),
  -- Internal, admin-only. The one column an admin may PATCH directly.
  notes             text check (notes is null or length(notes) <= 2000),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.customers is
  'One row per ordering email. Maintained by upsert_customer() (from place_order) and customer_recompute() (from a trigger on orders). Admin-read, admin-annotate, never deleted.';
comment on column public.customers.total_spent_cents is
  'Money actually collected: sum of total_cents over linked orders with payment_status = paid that are not cancelled/refunded.';

create index if not exists customers_last_order_idx
  on public.customers (last_order_at desc nulls last);
create index if not exists customers_spend_idx
  on public.customers (total_spent_cents desc);

drop trigger if exists trg_customers_updated_at on public.customers;
create trigger trg_customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- orders.customer_id
-- -----------------------------------------------------------------------------
-- Nullable, SET NULL on delete: an order is a financial record and must never
-- be blocked or removed by anything that happens to the customer row.
-- tg_orders_immutable_money (0005) freezes the money columns, order_number,
-- the token hash, the idempotency key and created_at — customer_id is not on
-- that list, so linking an existing order is an ordinary UPDATE.
alter table public.orders
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

create index if not exists orders_customer_idx
  on public.orders (customer_id) where customer_id is not null;

-- -----------------------------------------------------------------------------
-- upsert_customer — find-or-create by email. Called from place_order only.
-- -----------------------------------------------------------------------------
-- The newest name wins (people correct typos on their second order); a phone
-- number is only ever replaced by another phone number, never by nothing.
create or replace function public.upsert_customer(p_email text, p_name text, p_phone text)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  insert into public.customers (email, name, phone, first_order_at, last_order_at)
  values (lower(btrim(p_email)),
          btrim(p_name),
          nullif(btrim(coalesce(p_phone, '')), ''),
          now(), now())
  on conflict (email) do update
    set name          = excluded.name,
        phone         = coalesce(excluded.phone, customers.phone),
        last_order_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

-- Owner-only: reachable from inside place_order and nowhere else. Granting it
-- to an application role would let anyone create or rename customers.
revoke execute on function public.upsert_customer(text, text, text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- customer_recompute — the single source of truth for the aggregate columns.
-- -----------------------------------------------------------------------------
create or replace function public.customer_recompute(p_customer_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if p_customer_id is null then
    return;
  end if;

  -- An aggregate with no GROUP BY always yields exactly one row, so a customer
  -- whose last order was just unlinked correctly drops to 0 / 0 / null / null.
  update public.customers c
     set orders_count      = s.orders_count,
         total_spent_cents = s.total_spent_cents,
         first_order_at    = s.first_order_at,
         last_order_at     = s.last_order_at
    from (
      select count(*) filter (where o.status not in ('cancelled', 'refunded'))::integer
               as orders_count,
             coalesce(sum(o.total_cents) filter (
               where o.payment_status = 'paid'
                 and o.status not in ('cancelled', 'refunded')), 0)::bigint
               as total_spent_cents,
             min(o.created_at) as first_order_at,
             max(o.created_at) as last_order_at
        from public.orders o
       where o.customer_id = p_customer_id
    ) s
   where c.id = p_customer_id;
end;
$$;

revoke execute on function public.customer_recompute(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Trigger: any change to an order's status, payment or owner refreshes the
-- customer(s) involved. AFTER, so it sees the row as written.
-- -----------------------------------------------------------------------------
create or replace function public.tg_orders_customer_stats()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.customer_id is not null then
    perform public.customer_recompute(new.customer_id);
  end if;
  -- Re-pointing an order at a different customer must also correct the one
  -- it left.
  if tg_op = 'UPDATE'
     and old.customer_id is not null
     and old.customer_id is distinct from new.customer_id then
    perform public.customer_recompute(old.customer_id);
  end if;
  return null;
end;
$$;

revoke execute on function public.tg_orders_customer_stats() from public;

drop trigger if exists trg_orders_customer_stats on public.orders;
create trigger trg_orders_customer_stats
  after insert or update of status, payment_status, customer_id on public.orders
  for each row execute function public.tg_orders_customer_stats();

-- -----------------------------------------------------------------------------
-- place_order — the ONE door into the orders tables.
--
-- IDENTICAL to 0006 (same signature, same body) except for three marked
-- changes: the customer row is upserted just before the order is written, the
-- order carries its customer_id, and the duplicate (idempotent replay) branch
-- also reports payment_method and payment_status so the checkout route can
-- tell a replayed card order that is still unpaid from one that has been paid.
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
  v_customer_id uuid;                                  -- 0014
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
        'payment_method', v_existing.payment_method,   -- 0014
        'payment_status', v_existing.payment_status,   -- 0014
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

  -- 0014: find-or-create the customer from the SAME validated, normalised
  -- values the order row is about to be written with (v_email is already
  -- lowercased and trimmed; upsert_customer trims name and phone).
  v_customer_id := public.upsert_customer(v_email, p_customer->>'name', p_customer->>'phone');

  -- 6. Write. The deferred constraint trigger from 0005 re-checks at COMMIT
  --    that this subtotal equals the sum of the items inserted below.
  insert into public.orders (
    user_id, status, payment_status, payment_method, currency,
    subtotal_cents, shipping_cents, discount_cents, total_cents,
    customer_name, customer_email, customer_phone,
    shipping_line1, shipping_line2, shipping_city, shipping_district,
    shipping_postal_code, shipping_country,
    customer_note, access_token_hash, idempotency_key,
    customer_id                                        -- 0014
  ) values (
    auth.uid(), 'pending', 'unpaid', p_payment_method, 'LKR',
    v_subtotal, v_shipping, 0, v_subtotal + v_shipping,
    btrim(p_customer->>'name'), v_email, btrim(p_customer->>'phone'),
    btrim(p_shipping->>'line1'), nullif(btrim(coalesce(p_shipping->>'line2','')), ''),
    btrim(p_shipping->>'city'), nullif(btrim(coalesce(p_shipping->>'district','')), ''),
    nullif(btrim(coalesce(p_shipping->>'postal_code','')), ''),
    upper(coalesce(nullif(btrim(coalesce(p_shipping->>'country','')), ''), 'LK')),
    nullif(btrim(coalesce(p_note, '')), ''),
    public.hash_order_token(v_token), p_idempotency_key,
    v_customer_id                                      -- 0014
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

-- Server only — see 0016_security_hardening.sql.
revoke execute on function public.place_order(jsonb, jsonb, jsonb, public.payment_method, text, text, text) from public, anon, authenticated;
grant  execute on function public.place_order(jsonb, jsonb, jsonb, public.payment_method, text, text, text) to service_role;

-- -----------------------------------------------------------------------------
-- Backfill: every order placed before this file existed gets a customer.
-- -----------------------------------------------------------------------------
-- One customer per lowercased email, taking the name and phone from that
-- address's most recent order. The guards on name and phone can only matter
-- for a row that predates the CHECKs on orders; they are here so a single odd
-- historical row cannot abort the whole migration. first/last_order_at are
-- left NULL here and filled by the recompute below.
insert into public.customers (email, name, phone, first_order_at, last_order_at)
select distinct on (lower(o.customer_email))
       lower(o.customer_email),
       case when length(btrim(o.customer_name)) < 2 then 'Customer'
            else left(btrim(o.customer_name), 120) end,
       case when btrim(coalesce(o.customer_phone, '')) ~ '^[0-9+][0-9 +()-]{6,19}$'
            then btrim(o.customer_phone) else null end,
       null, null
  from public.orders o
 where lower(o.customer_email) ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
   and length(o.customer_email) <= 254
 order by lower(o.customer_email), o.created_at desc
on conflict (email) do nothing;

-- Link. This fires trg_orders_customer_stats per row (harmless: the recompute
-- is idempotent) and, like any UPDATE on orders, stamps updated_at.
update public.orders o
   set customer_id = c.id
  from public.customers c
 where o.customer_id is null
   and lower(o.customer_email) = c.email;

-- Recompute everyone once, from scratch, so the aggregates are right even for
-- a customer whose orders were all linked before this run.
do $$
begin
  perform public.customer_recompute(c.id) from public.customers c;
end
$$;

-- -----------------------------------------------------------------------------
-- RLS + GRANTS — the orders pattern from 0005: grants first, then policies,
-- then a RESTRICTIVE backstop no later permissive policy can widen.
-- -----------------------------------------------------------------------------
alter table public.customers enable row level security;

revoke all on public.customers from anon, authenticated, public;

-- anon ends with NO privilege. Rows are created only by place_order() and
-- reshaped only by customer_recompute(), both of which run as the owner.
grant select on public.customers to authenticated;
-- Column-level UPDATE: through PostgREST an admin can PATCH the note and
-- nothing else. Name, phone and the aggregates are written by the functions
-- above. There is NO delete grant: a customer row is the index into a
-- financial history and is never removed.
grant update (notes) on public.customers to authenticated;

drop policy if exists customers_admin_read     on public.customers;
drop policy if exists customers_admin_annotate on public.customers;
drop policy if exists customers_admin_only     on public.customers;

create policy customers_admin_read on public.customers
  for select to authenticated using ((select public.is_admin()));

create policy customers_admin_annotate on public.customers
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy customers_admin_only on public.customers
  as restrictive for all to anon, authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- IMPORTANT, and not expressible in SQL: do NOT add customers to the
-- supabase_realtime publication, for the same reason as orders.

-- ---------------------------------------------------------------------------
-- Sanity report.
-- ---------------------------------------------------------------------------
do $$
declare c int; linked int; unlinked int;
begin
  select count(*) into c from public.customers;
  select count(*) into linked   from public.orders where customer_id is not null;
  select count(*) into unlinked from public.orders where customer_id is null;
  raise notice 'Franley customers: % customers, % orders linked, % orders without a customer',
    c, linked, unlinked;
end
$$;
