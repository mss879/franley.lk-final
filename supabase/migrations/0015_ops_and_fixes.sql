-- =============================================================================
-- 0015_ops_and_fixes.sql
-- FEATURE: Four small operational fixes found while wiring the admin to the
--          database. No new tables.
--
--            1. tg_categories_no_cycle also refuses to give a parent to a
--               category that already has children. The upward walk in 0003
--               caught A -> B -> A and a grandchild being ADDED, but not a
--               parent being demoted underneath its own children, which left
--               the tree three deep with every check passing. The app patched
--               this in assertParentAllowed(); now the database does.
--            2. admin_update_order_status stamps paid_at when a cash-on-
--               delivery order is delivered. 0006 already flips
--               payment_status to 'paid' on that move; since 0012 the moment
--               of payment has a column, and COD was the one path not filling
--               it.
--            3. get_order_by_token also returns payment_method_detail and
--               paid_at, so the order page can say "Paid with VISA on ...".
--            4. admin_cancel_stale_card_orders(): a card order whose shopper
--               closed the PayHere window holds its stock for ever. This
--               releases every pending card order still unpaid after N hours
--               (default 24) through admin_cancel_order, so the restock is the
--               same audited path a manual cancellation takes.
--            5. Five site_settings rows that 0009 seeded with placeholder
--               contact details and the old tagline are corrected to the real
--               values — but ONLY while a row still holds the 0009 placeholder,
--               so an edit the owner has already made in the admin is never
--               overwritten. The storefront is about to start reading these.
--
-- SAFE TO RE-RUN: yes. Functions are CREATE OR REPLACE with grants re-applied;
--          the trigger is dropped before being created; the settings updates
--          match on the placeholder value and so are no-ops the second time.
--
-- RE-RUN THIS FILE AFTER ANY RE-RUN OF 0003 OR 0006. Those files would put the
--          earlier bodies of tg_categories_no_cycle, admin_update_order_status
--          and get_order_by_token back.
--
-- KNOWN AND ACCEPTED:
--   * Duplicate audit rows. trg_orders_log_event (0005) writes an order_events
--     row for every status / payment_status change, and admin_cancel_order,
--     admin_update_order_status (when given a note), admin_set_payment_status
--     (when given a note) and record_gateway_payment each insert a second,
--     more descriptive row of their own. So one admin action can show as two
--     events. That is deliberate: the trigger row is the tamper-proof "what
--     changed", the explicit row is the "why", and collapsing them would mean
--     either losing the reason or trusting application code to log the change.
--   * public.is_owner() (0002) is defined and granted but nothing calls it
--     yet. It is kept as the hook for an admin-management screen; removing it
--     would be a behaviour change to 0002 for no gain.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Categories: no cycles, two levels deep, and a parent stays a parent.
-- -----------------------------------------------------------------------------
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
  -- The upward walk from 0003, unchanged.
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

  -- 0015: the downward check. A category that has children is a top-level
  -- category by definition; moving it under another would make its children
  -- grandchildren without any of THEIR rows changing, so nothing else can
  -- catch it. On INSERT new.id is fresh and has no children, so this is
  -- effectively an UPDATE-only rule.
  if new.parent_id is not null
     and exists (select 1 from public.categories c where c.parent_id = new.id) then
    raise exception 'A category with sub-categories must stay top level'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_categories_no_cycle on public.categories;
create trigger trg_categories_no_cycle
  before insert or update of parent_id on public.categories
  for each row execute function public.tg_categories_no_cycle();

-- -----------------------------------------------------------------------------
-- 2. admin_update_order_status — the only way an order's status moves.
--    IDENTICAL to 0006 except for the paid_at line in the UPDATE (marked).
--
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
                          end,
         -- 0015: cash changes hands at the door. Every column on the right of
         -- this SET reads the row as it was, so payment_status here is the
         -- value BEFORE the line above flips it; a COD order already marked
         -- paid by hand keeps the paid_at it has.
         paid_at      = case
                          when p_status = 'delivered' and payment_method = 'cod'
                               and payment_status <> 'paid'
                            then coalesce(paid_at, now())
                          else paid_at
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
-- 3. get_order_by_token — "track my order" for a guest with no account.
--    IDENTICAL to 0006 except for the two payment fields added to the returned
--    object (marked). Still a hand-enumerated column list: admin_note,
--    idempotency_key, access_token_hash, payment_gateway and payment_reference
--    stay out.
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
    'payment_method_detail', v_o.payment_method_detail,   -- 0015
    'paid_at',         v_o.paid_at,                       -- 0015
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
-- 4. admin_cancel_stale_card_orders — release stock held by abandoned card
--    checkouts.
--
-- A card order is 'pending' / 'unpaid' from the moment place_order de-stocks
-- it until PayHere's notification marks it paid. A shopper who closes the
-- payment window leaves that order holding its units indefinitely. This
-- cancels — with restock, through admin_cancel_order, so it is audited like
-- any other cancellation — every such order older than p_hours.
--
-- Why only payment_status in (unpaid, pending, failed) and status = 'pending':
-- a paid card order is 'confirmed' and untouchable here; an order already
-- cancelled or refunded is terminal. The window is clamped to 1..720 hours so
-- a typo cannot release orders placed a minute ago, and FOR UPDATE SKIP LOCKED
-- lets a PayHere notification that is marking one of these paid at this very
-- moment win — that order is simply skipped this round.
-- -----------------------------------------------------------------------------
create or replace function public.admin_cancel_stale_card_orders(p_hours integer default 24)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_hours   integer := least(greatest(coalesce(p_hours, 24), 1), 720);
  v_numbers text[]  := '{}';
  r         record;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  for r in
    select o.id, o.order_number
      from public.orders o
     where o.payment_method = 'card'
       and o.payment_status in ('unpaid', 'pending', 'failed')
       and o.status = 'pending'
       and o.created_at < now() - make_interval(hours => v_hours)
     order by o.created_at
       for update skip locked
  loop
    perform public.admin_cancel_order(
      r.id, true, format('Unpaid card order released after %s hours', v_hours));
    v_numbers := v_numbers || r.order_number;
  end loop;

  return jsonb_build_object(
    'released',      coalesce(array_length(v_numbers, 1), 0),
    'order_numbers', to_jsonb(v_numbers));
end;
$$;

revoke execute on function public.admin_cancel_stale_card_orders(integer) from public, anon;
grant  execute on function public.admin_cancel_stale_card_orders(integer) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Real contact details and tagline in site_settings.
--
-- 0009 seeded placeholders ("+94 77 000 0000", hello@franley.lk, the old
-- tagline) while src/lib/constants.ts carried the real values; once the
-- storefront reads site_settings that drift would show up in the footer and
-- on every page title. Each value is replaced ONLY while it still equals the
-- 0009 placeholder — a value the owner has since typed into the admin is left
-- exactly as they set it — and default_value is moved so "Reset to default"
-- in the admin lands on the real value, not the placeholder.
-- tg_settings_lock_guard guards key / type / group / visibility only, so a
-- value change on a locked row is allowed. payment.bank_transfer_details is
-- deliberately untouched: the owner fills that in.
-- -----------------------------------------------------------------------------
update public.site_settings
   set value = '"+94 70 750 7722"'::jsonb, default_value = '"+94 70 750 7722"'::jsonb
 where key = 'contact.phone' and value = '"+94 77 000 0000"'::jsonb;
update public.site_settings
   set default_value = '"+94 70 750 7722"'::jsonb
 where key = 'contact.phone' and default_value = '"+94 77 000 0000"'::jsonb;

update public.site_settings
   set value = '"+94707507722"'::jsonb, default_value = '"+94707507722"'::jsonb
 where key = 'contact.whatsapp' and value = '"+94770000000"'::jsonb;
update public.site_settings
   set default_value = '"+94707507722"'::jsonb
 where key = 'contact.whatsapp' and default_value = '"+94770000000"'::jsonb;

update public.site_settings
   set value = '"support@franley.lk"'::jsonb, default_value = '"support@franley.lk"'::jsonb
 where key = 'contact.email' and value = '"hello@franley.lk"'::jsonb;
update public.site_settings
   set default_value = '"support@franley.lk"'::jsonb
 where key = 'contact.email' and default_value = '"hello@franley.lk"'::jsonb;

update public.site_settings
   set value = '"The Art of Modern Man"'::jsonb, default_value = '"The Art of Modern Man"'::jsonb
 where key = 'store.tagline' and value = '"Individual Men''s Neckwear"'::jsonb;
update public.site_settings
   set default_value = '"The Art of Modern Man"'::jsonb
 where key = 'store.tagline' and default_value = '"Individual Men''s Neckwear"'::jsonb;

update public.site_settings
   set value = '"Franley — The Art of Modern Man"'::jsonb, default_value = '"Franley — The Art of Modern Man"'::jsonb
 where key = 'seo.default_title' and value = '"Franley — Individual Men''s Neckwear"'::jsonb;
update public.site_settings
   set default_value = '"Franley — The Art of Modern Man"'::jsonb
 where key = 'seo.default_title' and default_value = '"Franley — Individual Men''s Neckwear"'::jsonb;

-- ---------------------------------------------------------------------------
-- Sanity report.
-- ---------------------------------------------------------------------------
do $$
declare v_stale int; v_placeholders int;
begin
  select count(*) into v_placeholders
    from public.site_settings
   where (key = 'contact.phone'      and value = '"+94 77 000 0000"'::jsonb)
      or (key = 'contact.whatsapp'   and value = '"+94770000000"'::jsonb)
      or (key = 'contact.email'      and value = '"hello@franley.lk"'::jsonb)
      or (key = 'store.tagline'      and value = '"Individual Men''s Neckwear"'::jsonb)
      or (key = 'seo.default_title'  and value = '"Franley — Individual Men''s Neckwear"'::jsonb);
  raise notice 'Franley settings: % placeholder contact/tagline value(s) remaining (expect 0).', v_placeholders;

  select count(*) into v_stale
    from public.orders
   where payment_method = 'card'
     and payment_status in ('unpaid', 'pending', 'failed')
     and status = 'pending'
     and created_at < now() - interval '24 hours';
  raise notice 'Franley ops: category parent guard, COD paid_at, order-page payment fields and admin_cancel_stale_card_orders() installed. % card order(s) currently unpaid for more than 24 hours.',
    v_stale;
end
$$;
