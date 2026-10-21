-- =============================================================================
-- 0017_push_notifications.sql
-- FEATURE: New-order alerts on the admin's phone.
--
--          An admin turns alerts on in Admin -> Settings, on each phone or
--          computer that should ring. The browser hands back a push
--          "subscription" (an address at Apple's, Google's or Mozilla's push
--          service plus two keys); it is stored here, and the server sends a
--          notification to every stored address when an order comes in.
--
-- SAFE TO RE-RUN: yes.
--
-- WHY THE WRITES GO THROUGH A FUNCTION:
--   * One phone has one subscription address. If a second admin signs in on
--     the same phone and turns alerts on, the row has to move to them — an
--     UPDATE of another admin's row, which an "own rows only" policy rightly
--     refuses. save_push_subscription() does that one move and nothing else,
--     and only for a caller who is an admin right now.
--   * The keys in a subscription let anyone who holds them send that phone a
--     notification that looks like it came from the shop. So admins can see
--     and remove their OWN devices, and only the server (service_role) reads
--     them all to send.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- admin_push_subscriptions — one row per device with alerts turned on
-- -----------------------------------------------------------------------------
create table if not exists public.admin_push_subscriptions (
  id               uuid primary key default gen_random_uuid(),
  -- Removing an admin (or their auth user) removes their devices with them.
  user_id          uuid not null references public.admin_users(user_id) on delete cascade,
  -- Where the push service accepts messages for this device. Always https.
  endpoint         text not null
                     check (endpoint ~ '^https://' and length(endpoint) <= 2000),
  -- The browser's encryption keys for this subscription (base64url).
  p256dh           text not null check (length(p256dh) between 20 and 200),
  auth             text not null check (length(auth) between 8 and 100),
  -- "iPhone · Safari", shown in the device list so the right one can be removed.
  device_label     text check (device_label is null or length(device_label) <= 120),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  last_success_at  timestamptz,
  last_error       text check (last_error is null or length(last_error) <= 500)
);

comment on table public.admin_push_subscriptions is
  'Devices that get a notification for every new order. Admins see and remove their own; the server reads all of them to send.';

create unique index if not exists admin_push_subscriptions_endpoint_key
  on public.admin_push_subscriptions (endpoint);
create index if not exists admin_push_subscriptions_user_idx
  on public.admin_push_subscriptions (user_id);

drop trigger if exists trg_admin_push_subscriptions_updated_at on public.admin_push_subscriptions;
create trigger trg_admin_push_subscriptions_updated_at
  before update on public.admin_push_subscriptions
  for each row execute function public.set_updated_at();

alter table public.admin_push_subscriptions enable row level security;

revoke all on public.admin_push_subscriptions from anon, authenticated, public;
grant select (id, user_id, endpoint, device_label, created_at, last_success_at, last_error),
      delete
   on public.admin_push_subscriptions to authenticated;

drop policy if exists admin_push_subscriptions_own_read on public.admin_push_subscriptions;
create policy admin_push_subscriptions_own_read on public.admin_push_subscriptions
  for select to authenticated
  using (user_id = auth.uid() and public.is_admin());

drop policy if exists admin_push_subscriptions_own_delete on public.admin_push_subscriptions;
create policy admin_push_subscriptions_own_delete on public.admin_push_subscriptions
  for delete to authenticated
  using (user_id = auth.uid() and public.is_admin());

-- Restrictive backstop, as on the other private tables: no permissive policy
-- added later can widen this beyond admins.
drop policy if exists admin_push_subscriptions_admin_only on public.admin_push_subscriptions;
create policy admin_push_subscriptions_admin_only on public.admin_push_subscriptions
  as restrictive for all to anon, authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- save_push_subscription — turn alerts on for the device the caller is using
-- -----------------------------------------------------------------------------
create or replace function public.save_push_subscription(
  p_endpoint text,
  p_p256dh   text,
  p_auth     text,
  p_label    text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can turn on order alerts.' using errcode = '42501';
  end if;

  insert into public.admin_push_subscriptions (user_id, endpoint, p256dh, auth, device_label)
  values (auth.uid(), btrim(p_endpoint), btrim(p_p256dh), btrim(p_auth), nullif(left(btrim(coalesce(p_label, '')), 120), ''))
  on conflict (endpoint) do update
    set user_id         = excluded.user_id,
        p256dh          = excluded.p256dh,
        auth            = excluded.auth,
        device_label    = excluded.device_label,
        last_error      = null
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.save_push_subscription(text, text, text, text) is
  'Stores (or re-assigns to the caller) the push subscription of the device an admin is using.';

revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
grant  execute on function public.save_push_subscription(text, text, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- admin_push_log — the send lock: one new-order alert per order, ever
-- -----------------------------------------------------------------------------
-- PayHere can report the same payment several times, and checkout can be
-- retried. The server inserts this row BEFORE sending; the primary key makes
-- the second attempt lose the insert and send nothing — the same pattern as
-- email_log (0011).
create table if not exists public.admin_push_log (
  order_id     uuid primary key references public.orders(id) on delete cascade,
  sent_count   integer not null default 0 check (sent_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  created_at   timestamptz not null default now()
);

comment on table public.admin_push_log is
  'One row per order whose new-order alert has been sent. Written by the server only.';

alter table public.admin_push_log enable row level security;

revoke all on public.admin_push_log from anon, authenticated, public;
grant select on public.admin_push_log to authenticated;

drop policy if exists admin_push_log_admin_read on public.admin_push_log;
create policy admin_push_log_admin_read on public.admin_push_log
  for select to authenticated
  using (public.is_admin());

drop policy if exists admin_push_log_admin_only on public.admin_push_log;
create policy admin_push_log_admin_only on public.admin_push_log
  as restrictive for all to anon, authenticated
  using (public.is_admin())
  with check (public.is_admin());

do $$
begin
  raise notice '0017 applied: admin push subscriptions and the new-order alert log are ready.';
end
$$;
