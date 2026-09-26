-- =============================================================================
-- 0016_security_hardening.sql
-- FEATURE: Closes the findings of the pre-launch security review. No new
--          tables; one CHECK widened, one function added.
--
--            1. place_order is executable by service_role ONLY. It used to be
--               granted to anon, and the publishable key ships in the browser,
--               so anyone could call /rest/v1/rpc/place_order directly with a
--               random p_ip_hint per call — past the per-address throttle —
--               and reserve the whole catalogue as unpaid cash-on-delivery
--               orders in a handful of requests. /api/checkout now calls it
--               with the service key and passes the shopper's real address.
--            2. get_order_by_token drops its lookup throttle. The order page
--               and the "Pay now" route call it from the server, so every
--               shopper shared ONE counter (the server's address): anyone with
--               a single order could exhaust it and take every order page down
--               for an hour. It never slowed token guessing either — a failed
--               lookup raises and rolls its counter row back. The 244-bit token
--               is the control; request-rate limits belong at the edge.
--            3. upsert_customer never overwrites a known customer's name or
--               phone. Anyone can order with anyone's email address, and the
--               admin Customers screen must not start showing a stranger's
--               phone number against a real customer. Each order still keeps
--               the details typed for it.
--            4. The media buckets can no longer be LISTED anonymously (which
--               revealed photos of unreleased products). Public object URLs
--               keep working: a public bucket serves them without RLS.
--            5. grant_admin refuses an account whose email is unconfirmed, so
--               a stranger who signs up with the owner's address first cannot
--               be promoted by mistake.
--            6. is_safe_asset_url / is_safe_link_href reject "//host" and
--               "/\host", which browsers treat as links to another site.
--            7. is_owner() is no longer executable by anon.
--            8. throttle_take(): a general best-effort counter, service_role
--               only, used by the contact form so it cannot be scripted into
--               an email flood that also exhausts the order-email quota.
--
-- SAFE TO RE-RUN: yes. Grants are idempotent, functions are CREATE OR REPLACE,
--          the storage policy is dropped before being created, and the CHECK
--          is dropped and re-added.
--
-- RUN AFTER 0015, then re-run 0010 (guardrails) last.
--
-- RE-RUN THIS FILE AFTER ANY RE-RUN OF 0001, 0002, 0014 OR 0015. Those files
--          would put back the earlier bodies of is_safe_asset_url /
--          is_safe_link_href, grant_admin / is_owner's grants,
--          upsert_customer, and get_order_by_token with its throttle.
--          (0006, 0007 and 0014 were edited so that re-running them no longer
--          re-grants place_order to anon or re-opens bucket listing.)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. place_order — server only.
-- -----------------------------------------------------------------------------
-- Supabase's default privileges grant EXECUTE on every new function to anon,
-- authenticated and service_role individually, so "from public" alone never
-- removed anon's grant. All three are named.
revoke execute on function public.place_order(jsonb, jsonb, jsonb, public.payment_method, text, text, text)
  from public, anon, authenticated;
grant  execute on function public.place_order(jsonb, jsonb, jsonb, public.payment_method, text, text, text)
  to service_role;

-- -----------------------------------------------------------------------------
-- 2. get_order_by_token — IDENTICAL to 0015 except that the lookup throttle
--    (and the four variables it used) is gone. Still a hand-enumerated column
--    list: admin_note, idempotency_key, access_token_hash, payment_gateway and
--    payment_reference stay out.
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
begin
  -- Shape first: a malformed token is rejected before anything is read.
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid order link' using errcode = '22023';
  end if;

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

  return jsonb_build_object(
    'order_number',    v_o.order_number,
    'status',          v_o.status,
    'payment_status',  v_o.payment_status,
    'payment_method',  v_o.payment_method,
    'payment_method_detail', v_o.payment_method_detail,
    'paid_at',         v_o.paid_at,
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
-- 3. upsert_customer — first details stick; a missing phone may be filled.
-- -----------------------------------------------------------------------------
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
    set phone         = coalesce(customers.phone, excluded.phone),
        last_order_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.upsert_customer(text, text, text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Media buckets: no anonymous listing.
-- -----------------------------------------------------------------------------
-- Uploading needs only INSERT; removing needs SELECT + DELETE — both admin, so
-- the admin keeps a read policy. Shoppers never needed one: public-bucket URLs
-- (/storage/v1/object/public/...) are served without consulting RLS.
do $$
begin
  execute 'drop policy if exists franley_public_read_media on storage.objects';
  execute 'drop policy if exists franley_admin_read_media on storage.objects';
  execute $p$
    create policy franley_admin_read_media on storage.objects
      for select to authenticated
      using (bucket_id in ('product-images', 'cms-media') and (select public.is_admin()))
  $p$;
exception
  when insufficient_privilege then
    raise warning 'Could not replace the storage read policy (insufficient privilege). In Dashboard -> Storage -> Policies, delete "franley_public_read_media" and add a SELECT policy for authenticated users using: bucket_id in (''product-images'', ''cms-media'') and public.is_admin().';
  when undefined_table then
    raise warning 'storage.objects not found — skipping. This is expected outside Supabase.';
end
$$;

-- -----------------------------------------------------------------------------
-- 5. grant_admin — confirmed accounts only. Body as 0002 plus the check.
-- -----------------------------------------------------------------------------
create or replace function public.grant_admin(p_email text, p_role text default 'admin')
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id   uuid;
  v_confirmed timestamptz;
  v_role      public.admin_role;
begin
  if p_role not in ('owner', 'admin') then
    raise exception 'role must be owner or admin, got %', p_role
      using errcode = '22023';
  end if;
  v_role := p_role::public.admin_role;

  select u.id, u.email_confirmed_at into v_user_id, v_confirmed
    from auth.users u
   where lower(u.email) = lower(btrim(p_email))
   limit 1;

  if v_user_id is null then
    raise exception
      'No auth user with email %. Create the user first in Supabase Dashboard -> Authentication -> Users -> Add user (tick "Auto Confirm User"), then run this again.',
      p_email using errcode = 'P0002';
  end if;

  -- Anyone can sign up with any address while sign-ups are open. An account
  -- nobody has confirmed may belong to a stranger holding its password.
  if v_confirmed is null then
    raise exception
      'The account % has not confirmed its email address. If you did not create it yourself, delete it in Authentication -> Users and add it again with "Auto Confirm User" ticked.',
      p_email using errcode = '42501';
  end if;

  insert into public.admin_users (user_id, email, role, is_active, revoked_at, created_by)
  values (v_user_id, lower(btrim(p_email)), v_role, true, null, auth.uid())
  on conflict (user_id) do update
    set role       = excluded.role,
        email      = excluded.email,
        is_active  = true,
        revoked_at = null;

  return v_user_id;
end;
$$;

revoke execute on function public.grant_admin(text, text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6. URL helpers — "//evil.example" and "/\evil.example" are off-site links.
-- -----------------------------------------------------------------------------
create or replace function public.is_safe_asset_url(p_url text)
returns boolean
language sql
immutable
parallel safe
as $$
  select p_url is null
      or (
        length(p_url) between 1 and 2048
        and p_url ~ '^(https://|/(?![/\\])|product-images/|cms-media/)'
        and p_url !~* '^[[:space:]]*(javascript|data|vbscript):'
      );
$$;

create or replace function public.is_safe_link_href(p_href text)
returns boolean
language sql
immutable
parallel safe
as $$
  select p_href is null
      or (
        length(p_href) between 1 and 2048
        and p_href ~ '^(https://|/(?![/\\]))'
        and p_href !~* '^[[:space:]]*(javascript|data|vbscript):'
      );
$$;

-- -----------------------------------------------------------------------------
-- 7. is_owner() — authenticated only, as 0002 intended.
-- -----------------------------------------------------------------------------
revoke execute on function public.is_owner() from public, anon;
grant  execute on function public.is_owner() to authenticated;

-- -----------------------------------------------------------------------------
-- 8. throttle_take — a counter for callers other than place_order.
-- -----------------------------------------------------------------------------
alter table public.checkout_throttle drop constraint if exists checkout_throttle_kind_check;
alter table public.checkout_throttle add constraint checkout_throttle_kind_check
  check (kind in ('place_order', 'order_lookup', 'contact'));

-- Returns true and records a hit while fewer than p_limit hits exist for this
-- key in the window; false (recording nothing) once the limit is reached. The
-- key is hashed with the same salt as the checkout buckets — never stored raw.
create or replace function public.throttle_take(p_kind text, p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_bucket bytea;
  v_hits   integer;
begin
  if p_kind is distinct from 'contact' then
    raise exception 'Unknown throttle kind %', p_kind using errcode = '22023';
  end if;

  v_bucket := public.throttle_bucket(p_kind || '|' || coalesce(nullif(btrim(p_key), ''), 'unknown'));

  delete from public.checkout_throttle where created_at < now() - interval '2 days';

  select count(*) into v_hits
    from public.checkout_throttle
   where kind = p_kind and bucket = v_bucket
     and created_at > now() - make_interval(secs => least(greatest(coalesce(p_window_seconds, 3600), 1), 172800));
  if v_hits >= greatest(coalesce(p_limit, 0), 0) then
    return false;
  end if;

  insert into public.checkout_throttle (bucket, kind) values (v_bucket, p_kind);
  return true;
end;
$$;

revoke execute on function public.throttle_take(text, text, integer, integer) from public, anon, authenticated;
grant  execute on function public.throttle_take(text, text, integer, integer) to service_role;

do $$
begin
  raise notice '0016 applied: place_order is service_role only; order lookups are unthrottled; bucket listing is admin only.';
end
$$;
