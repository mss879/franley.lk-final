-- =============================================================================
-- 0011_email_log.sql
-- FEATURE: A record of every transactional email the store sends, so a retried
--          request cannot email a customer twice and so the admin can see what
--          was sent for an order without leaving the panel.
--
-- SAFE TO RE-RUN: yes.
--
-- WHY A TABLE AND NOT JUST "call Resend and hope":
--   * Checkout is idempotent at the order level (place_order returns the
--     existing order for a repeated idempotency key), but the API route that
--     calls it can still be retried by a flaky network, a double-click, or a
--     platform-level retry. Without a uniqueness record, each retry sends
--     another "your order is confirmed" email.
--   * The unique index on (order_id, kind) is what makes the send
--     exactly-once: the sender claims its row FIRST, and only emails if the
--     insert won. A crash after claiming means one missed email, which is a far
--     better failure than five duplicates in a customer's inbox.
-- =============================================================================

do $$ begin
  create type public.email_kind as enum (
    'order_confirmation',   -- to the customer, immediately after checkout
    'order_admin_alert',    -- to the shop, immediately after checkout
    'order_shipped',        -- to the customer, when the admin marks it shipped
    'order_delivered',      -- to the customer, when the admin marks it delivered
    'order_cancelled',      -- to the customer, when the admin cancels it
    'contact_enquiry'       -- to the shop, from the contact form (no order_id)
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.email_status as enum ('pending', 'sent', 'failed');
exception when duplicate_object then null; end $$;

create table if not exists public.email_log (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid references public.orders(id) on delete cascade,
  kind          public.email_kind not null,
  recipient     text not null
                  check (recipient ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  subject       text not null check (length(subject) between 1 and 300),
  status        public.email_status not null default 'pending',
  -- Resend's message id, kept so a delivery question can be traced in their
  -- dashboard without guessing which send it was.
  provider_id   text check (provider_id is null or length(provider_id) <= 200),
  error         text check (error is null or length(error) <= 2000),
  attempts      integer not null default 0 check (attempts >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  sent_at       timestamptz
);

comment on table public.email_log is
  'One row per transactional email. The unique index below is the send lock: claim the row, then send.';

-- The exactly-once guarantee. One email of each kind per order, forever.
-- Partial on purpose: contact enquiries carry no order_id and a customer may
-- legitimately write in more than once, so they are exempt from the lock.
create unique index if not exists email_log_order_kind_key
  on public.email_log (order_id, kind) where order_id is not null;

create index if not exists email_log_created_idx on public.email_log (created_at desc);
create index if not exists email_log_status_idx on public.email_log (status) where status <> 'sent';

drop trigger if exists trg_email_log_updated_at on public.email_log;
create trigger trg_email_log_updated_at
  before update on public.email_log
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
-- The log holds customer email addresses, so it is admin-read-only. Writes come
-- from the server using the service-role key, which bypasses RLS entirely —
-- there is deliberately no INSERT or UPDATE policy for anon or authenticated.
alter table public.email_log enable row level security;

revoke all on public.email_log from anon, authenticated, public;
grant select on public.email_log to authenticated;

drop policy if exists email_log_admin_read on public.email_log;
create policy email_log_admin_read on public.email_log
  for select to authenticated
  using (public.is_admin());

-- A RESTRICTIVE backstop, matching the other PII tables: no future permissive
-- policy can widen this beyond admins.
drop policy if exists email_log_admin_only on public.email_log;
create policy email_log_admin_only on public.email_log
  as restrictive for all to anon, authenticated
  using (public.is_admin())
  with check (public.is_admin());
