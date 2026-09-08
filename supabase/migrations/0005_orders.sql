-- =============================================================================
-- 0005_orders.sql
-- FEATURE: Orders — the guest-checkout record, its immutable line items, an
--          append-only status audit trail, and a best-effort abuse counter.
--          This file creates the TABLES and their guarantees. The only way to
--          write an order is the RPC in 0006.
--
-- SAFE TO RE-RUN: yes.
--
-- THE GUEST-CHECKOUT PROBLEM, AND HOW IT IS SOLVED HERE
--   The requirement is: an anonymous shopper must be able to place an order,
--   without ever being able to read anyone else's.
--
--   The tempting answer — give anon an INSERT policy with a WITH CHECK — was
--   rejected, for four reasons:
--     1. A WITH CHECK cannot recompute a parent total from child rows that do
--        not exist yet, so client-sent prices could not be validated.
--     2. It cannot stop a client inserting the order and abandoning the items.
--     3. INSERT ... RETURNING (and PostgREST's return=representation) requires
--        a SELECT policy — so an INSERT-policy design pressures you into
--        writing a SELECT policy on orders, which is exactly where every
--        guest-checkout data breach lives.
--     4. Stock cannot be decremented atomically from a policy.
--
--   So: anon has NO privilege of any kind on orders or order_items — not
--   INSERT, not SELECT, not DELETE. There is nothing for an RLS mistake to
--   expose. The single door is public.place_order(), a SECURITY DEFINER
--   function whose signature contains no price, no total, no status, no order
--   number and no token — they cannot be forged because they cannot be passed.
--   A guest reads their own order back with a 244-bit random token returned
--   once at placement, of which only a sha256 hash is stored.
--
-- MONEY IS UNFORGEABLE AT THREE LEVELS, NOT ONE
--     1. order_items.line_total_cents is GENERATED ALWAYS AS
--        (unit_price_cents * quantity) STORED — no caller at any privilege
--        level can supply it.
--     2. A table CHECK forces total = subtotal + shipping - discount.
--     3. A DEFERRABLE INITIALLY DEFERRED constraint trigger asserts at COMMIT
--        that orders.subtotal_cents equals the sum of its item line totals.
--   Levels 1 and 3 bind service_role too, which RLS and column grants do not.
--   That matters because the realistic breach here is a leaked service key in
--   a bundle, not a clever anonymous request.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Human-facing order number. Sequential and enumerable BY DESIGN, which is
-- precisely why it is never accepted as an authenticator (see 0006).
-- -----------------------------------------------------------------------------
create sequence if not exists public.order_number_seq start with 1000 increment by 1;

create or replace function public.next_order_number()
returns text
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  select 'FR-' || lpad(nextval('public.order_number_seq')::text, 6, '0');
$$;

revoke execute on function public.next_order_number() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- orders
-- -----------------------------------------------------------------------------
create table if not exists public.orders (
  id                   uuid primary key default gen_random_uuid(),
  order_number         text not null unique default public.next_order_number(),
  -- NULL for guests, which is the normal case. There are no customer accounts.
  user_id              uuid references auth.users(id) on delete set null,

  status               public.order_status  not null default 'pending',
  payment_status       public.payment_status not null default 'unpaid',
  payment_method       public.payment_method not null default 'cod',
  currency             char(3) not null default 'LKR' check (currency = 'LKR'),

  subtotal_cents       integer not null check (subtotal_cents > 0),
  shipping_cents       integer not null default 0 check (shipping_cents >= 0),
  discount_cents       integer not null default 0 check (discount_cents >= 0),
  total_cents          integer not null check (total_cents > 0),
  constraint orders_total_balances
    check (total_cents = subtotal_cents + shipping_cents - discount_cents),
  constraint orders_discount_sane
    check (discount_cents <= subtotal_cents),

  customer_name        text not null check (length(btrim(customer_name)) between 2 and 120),
  customer_email       text not null
                         check (customer_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
                                and length(customer_email) <= 254),
  customer_phone       text not null check (customer_phone ~ '^[0-9+][0-9 +()-]{6,19}$'),

  shipping_line1       text not null check (length(btrim(shipping_line1)) between 3 and 200),
  shipping_line2       text check (shipping_line2 is null or length(shipping_line2) <= 200),
  shipping_city        text not null check (length(btrim(shipping_city)) between 2 and 100),
  shipping_district    text check (shipping_district is null or length(shipping_district) <= 100),
  shipping_postal_code text check (shipping_postal_code is null or shipping_postal_code ~ '^[0-9A-Za-z -]{3,12}$'),
  shipping_country     char(2) not null default 'LK',

  customer_note        text check (customer_note is null or length(customer_note) <= 1000),
  -- Internal. Never returned by get_order_by_token.
  admin_note           text check (admin_note is null or length(admin_note) <= 2000),
  tracking_number      text check (tracking_number is null or length(tracking_number) <= 80),

  -- sha256 of the one-time lookup token. The plaintext is returned by
  -- place_order exactly once and is stored nowhere.
  access_token_hash    bytea not null unique,
  -- A retried submit on a flaky mobile connection returns the existing order
  -- instead of charging and de-stocking twice. Idempotency is a security
  -- control here, not just UX.
  idempotency_key      text check (idempotency_key is null or length(idempotency_key) between 8 and 64),

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  confirmed_at         timestamptz,
  shipped_at           timestamptz,
  delivered_at         timestamptz,
  cancelled_at         timestamptz
);

comment on table public.orders is
  'One placed order. Created only by public.place_order(). Never deleted — a financial record gets cancelled.';

create unique index if not exists orders_idempotency_key
  on public.orders (idempotency_key) where idempotency_key is not null;
create index if not exists orders_admin_list_idx on public.orders (created_at desc);
create index if not exists orders_status_idx     on public.orders (status, created_at desc);
create index if not exists orders_email_idx      on public.orders (lower(customer_email));
create index if not exists orders_user_idx       on public.orders (user_id) where user_id is not null;

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- order_items — immutable line-item ledger
-- -----------------------------------------------------------------------------
-- Every commercially meaningful field is snapshotted at placement, so a later
-- price change, retitle or archive cannot rewrite history.
create table if not exists public.order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders(id) on delete cascade,
  -- Nullable on purpose: deleting a product must neither erase nor block the
  -- order it was sold in.
  product_id        uuid references public.products(id) on delete set null,
  product_slug      text not null check (length(product_slug) between 1 and 96),
  product_title     text not null check (length(product_title) between 1 and 200),
  -- The forward-compatibility seam for a future variants table, e.g.
  -- 'Navy - 6.5cm'. Populated today from colour + width.
  variant_label     text check (variant_label is null or length(variant_label) <= 80),
  variant_id        uuid,
  image_url         text check (image_url is null or length(image_url) <= 2048),
  unit_price_cents  integer not null check (unit_price_cents > 0),
  quantity          integer not null check (quantity between 1 and 50),
  -- A generated column cannot be supplied on INSERT by anyone, at any
  -- privilege level. The line total is arithmetic, not data.
  line_total_cents  integer generated always as (unit_price_cents * quantity) stored,
  created_at        timestamptz not null default now()
);

comment on column public.order_items.variant_id is
  'Reserved. Stays NULL until (if ever) product_variants exists, so that migration is purely additive.';

create index if not exists order_items_order_idx   on public.order_items (order_id);
create index if not exists order_items_product_idx on public.order_items (product_id) where product_id is not null;

-- -----------------------------------------------------------------------------
-- order_events — append-only audit trail
-- -----------------------------------------------------------------------------
create table if not exists public.order_events (
  id            bigint generated always as identity primary key,
  order_id      uuid not null references public.orders(id) on delete cascade,
  from_status   public.order_status,
  to_status     public.order_status,
  actor_kind    text not null default 'system'
                  check (actor_kind in ('system','admin','customer')),
  actor_user_id uuid references auth.users(id) on delete set null,
  note          text check (note is null or length(note) <= 500),
  created_at    timestamptz not null default now()
);

comment on table public.order_events is
  'Who changed what, when. Written ONLY by triggers and admin RPCs running as the table owner — an audit log the application can write directly is not an audit log.';

create index if not exists order_events_order_idx on public.order_events (order_id, created_at desc);

-- -----------------------------------------------------------------------------
-- checkout_throttle — best-effort abuse counter for the two anonymous RPCs
-- -----------------------------------------------------------------------------
create table if not exists public.checkout_throttle (
  id         bigint generated always as identity primary key,
  -- A salted hash of an IP or a lowercased email. Never a raw identifier.
  bucket     bytea not null,
  kind       text not null check (kind in ('place_order','order_lookup')),
  created_at timestamptz not null default now()
);

create index if not exists checkout_throttle_lookup_idx
  on public.checkout_throttle (kind, bucket, created_at desc);
create index if not exists checkout_throttle_sweep_idx
  on public.checkout_throttle (created_at);

-- -----------------------------------------------------------------------------
-- Integrity triggers
-- -----------------------------------------------------------------------------

-- The only control in this design that binds service_role. Column grants stop
-- the admin UI and RLS stops anon, but a leaked service key bypasses both — a
-- trigger does not care what role you are.
create or replace function public.tg_orders_immutable_money()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.subtotal_cents    is distinct from old.subtotal_cents
  or new.shipping_cents    is distinct from old.shipping_cents
  or new.discount_cents    is distinct from old.discount_cents
  or new.total_cents       is distinct from old.total_cents
  or new.currency          is distinct from old.currency
  or new.order_number      is distinct from old.order_number
  or new.access_token_hash is distinct from old.access_token_hash
  or new.idempotency_key   is distinct from old.idempotency_key
  or new.created_at        is distinct from old.created_at then
    raise exception 'Order money, identifiers and timestamps are immutable after placement (order %)', old.order_number
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orders_immutable_money on public.orders;
create trigger trg_orders_immutable_money
  before update on public.orders
  for each row execute function public.tg_orders_immutable_money();

-- Cross-row invariant, checked by the database itself at COMMIT. This closes
-- the loop: an order whose declared subtotal does not equal what was actually
-- bought cannot be committed, regardless of which role wrote it or by what
-- path. Deferred so place_order can insert the parent before the children.
create or replace function public.tg_orders_total_matches_items()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id uuid;
  v_sum      bigint;
  v_state    public.orders%rowtype;
begin
  -- Explicit branching rather than a CASE expression, so a field that does not
  -- exist on the firing table is never referenced.
  if tg_table_name = 'orders' then
    v_order_id := new.id;
  elsif tg_op = 'DELETE' then
    v_order_id := old.order_id;
  else
    v_order_id := new.order_id;
  end if;

  select * into v_state from public.orders where id = v_order_id;
  if not found then
    return null;  -- the order was deleted in this same transaction
  end if;

  select coalesce(sum(line_total_cents), 0) into v_sum
    from public.order_items where order_id = v_order_id;

  if v_sum = 0 then
    raise exception 'Order % has no line items', v_state.order_number using errcode = '23514';
  end if;

  if v_sum <> v_state.subtotal_cents then
    raise exception 'Order % subtotal (%) does not match the sum of its items (%)',
      v_state.order_number, v_state.subtotal_cents, v_sum using errcode = '23514';
  end if;

  return null;
end;
$$;

drop trigger if exists trg_orders_total_matches_items on public.orders;
create constraint trigger trg_orders_total_matches_items
  after insert or update on public.orders
  deferrable initially deferred
  for each row execute function public.tg_orders_total_matches_items();

drop trigger if exists trg_order_items_total_matches on public.order_items;
create constraint trigger trg_order_items_total_matches
  after insert or update or delete on public.order_items
  deferrable initially deferred
  for each row execute function public.tg_orders_total_matches_items();

-- Every creation and every status change writes its own audit row. Because
-- this runs as the table owner, order_events needs no INSERT grant or policy
-- for any application role at all.
create or replace function public.tg_orders_log_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_events (order_id, from_status, to_status, actor_kind, actor_user_id, note)
    values (new.id, null, new.status,
            case when auth.uid() is null then 'customer' else 'admin' end,
            auth.uid(), 'Order placed');
  elsif new.status is distinct from old.status
     or new.payment_status is distinct from old.payment_status then
    insert into public.order_events (order_id, from_status, to_status, actor_kind, actor_user_id, note)
    values (new.id, old.status, new.status,
            case when auth.uid() is null then 'system' else 'admin' end,
            auth.uid(),
            case when new.payment_status is distinct from old.payment_status
                 then 'payment: ' || old.payment_status::text || ' -> ' || new.payment_status::text
                 else null end);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_orders_log_event on public.orders;
create trigger trg_orders_log_event
  after insert or update of status, payment_status on public.orders
  for each row execute function public.tg_orders_log_event();

-- -----------------------------------------------------------------------------
-- RLS + GRANTS. Grants first: they are the gate that runs before any policy.
-- -----------------------------------------------------------------------------
alter table public.orders            enable row level security;
alter table public.order_items       enable row level security;
alter table public.order_events      enable row level security;
alter table public.checkout_throttle enable row level security;

revoke all on public.orders            from anon, authenticated, public;
revoke all on public.order_items       from anon, authenticated, public;
revoke all on public.order_events      from anon, authenticated, public;
revoke all on public.checkout_throttle from anon, authenticated, public;

-- anon ends with NO privilege whatsoever on any of these. Orders are inserted
-- only by place_order() and read back by get_order_by_token(), both of which
-- run as the table owner.
grant select on public.orders       to authenticated;
grant select on public.order_items  to authenticated;
grant select on public.order_events to authenticated;
-- Column-level UPDATE: through PostgREST an admin can only ever PATCH these
-- two annotation columns. Status moves through admin_update_order_status() so
-- the transition is validated and audited. There is NO delete grant anywhere.
grant update (admin_note, tracking_number) on public.orders to authenticated;

drop policy if exists orders_admin_read      on public.orders;
drop policy if exists orders_admin_annotate  on public.orders;
drop policy if exists orders_admin_only      on public.orders;

create policy orders_admin_read on public.orders
  for select to authenticated using ((select public.is_admin()));

create policy orders_admin_annotate on public.orders
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Permissive policies OR together, so one careless policy added in six months
-- would open this table. A RESTRICTIVE policy ANDs with everything and cannot
-- be widened by adding another permissive one. This is the durable guarantee
-- that no future migration accidentally publishes customer PII.
create policy orders_admin_only on public.orders
  as restrictive for all to anon, authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists order_items_admin_read on public.order_items;
drop policy if exists order_items_admin_only on public.order_items;

create policy order_items_admin_read on public.order_items
  for select to authenticated using ((select public.is_admin()));
create policy order_items_admin_only on public.order_items
  as restrictive for all to anon, authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists order_events_admin_read on public.order_events;
drop policy if exists order_events_admin_only on public.order_events;

create policy order_events_admin_read on public.order_events
  for select to authenticated using ((select public.is_admin()));
create policy order_events_admin_only on public.order_events
  as restrictive for all to anon, authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- checkout_throttle: RLS enabled with NO policies and NO grants, INTENTIONALLY.
-- Same pattern as admin_users — a locked table with exactly one door, the
-- SECURITY DEFINER functions in 0006.

-- IMPORTANT, and not expressible in SQL: do NOT add orders, order_items or
-- order_events to the supabase_realtime publication. Publication membership
-- plus any SELECT policy broadcasts every customer's name, phone and address.
