-- =============================================================================
-- 0001_init_extensions.sql
-- FEATURE: Foundation. Shared enum types, the updated_at trigger function and
--          a couple of tiny immutable helpers that later migrations rely on.
--          Adds no tables, so there is no RLS in this file.
--
-- SAFE TO RE-RUN: yes. Types are created inside exception-guarded DO blocks,
--          functions use CREATE OR REPLACE.
--
-- NOTE ON CRYPTO: nothing in this schema needs pgcrypto. Order-lookup tokens
--          are built from two gen_random_uuid() values (core since PG13) and
--          hashed with the core sha256(bytea) function (core since PG11).
--          That keeps every SECURITY DEFINER function working under the
--          pinned "search_path = public, pg_temp" without depending on which
--          schema an extension happens to live in.
-- =============================================================================

-- Postgres 15+ is required: RLS-safe views need WITH (security_invoker = true),
-- and 0010 asserts on that. Fail loudly rather than silently insecure.
do $$
begin
  if current_setting('server_version_num')::int < 150000 then
    raise exception 'Franley schema requires PostgreSQL 15 or newer (found %)',
      current_setting('server_version');
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- Enum types
-- -----------------------------------------------------------------------------

-- Product lifecycle. 'archived' is the soft delete: order_items point at
-- products, so rows are archived rather than removed.
do $$ begin
  create type public.product_status as enum ('active', 'draft', 'archived');
exception when duplicate_object then null; end $$;

-- Admin seniority. 'owner' may manage other admins; 'admin' may not.
do $$ begin
  create type public.admin_role as enum ('owner', 'admin');
exception when duplicate_object then null; end $$;

-- Order lifecycle. Cancelled and refunded are terminal.
do $$ begin
  create type public.order_status as enum
    ('pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum
    ('unpaid', 'pending', 'paid', 'refunded', 'failed');
exception when duplicate_object then null; end $$;

-- cod = cash on delivery, the default in Sri Lanka. bank_transfer = slip sent
-- over WhatsApp. card = reserved for a future gateway.
do $$ begin
  create type public.payment_method as enum ('cod', 'bank_transfer', 'card');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Shared trigger function: updated_at
-- -----------------------------------------------------------------------------
-- Server-set, never client-set, so an admin client cannot backdate a record to
-- hide when a price or a banner changed.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'BEFORE UPDATE trigger: stamps updated_at = now() server-side.';

-- -----------------------------------------------------------------------------
-- Small immutable helpers usable inside CHECK constraints
-- -----------------------------------------------------------------------------

-- Accepts an https:// URL, a site-relative path (/products/x.webp) or a bare
-- storage object key (product-images/...). Rejects javascript:, data: and
-- vbscript: — an admin-typed URL is rendered straight into <img src>, and that
-- is the shortest path from a phished admin session to stored XSS.
create or replace function public.is_safe_asset_url(p_url text)
returns boolean
language sql
immutable
parallel safe
as $$
  select p_url is null
      or (
        length(p_url) between 1 and 2048
        and p_url ~ '^(https://|/|product-images/|cms-media/)'
        and p_url !~* '^[[:space:]]*(javascript|data|vbscript):'
      );
$$;

comment on function public.is_safe_asset_url(text) is
  'CHECK-constraint helper. True for https / site-relative / storage-key URLs; false for script-bearing schemes.';

create or replace function public.is_safe_link_href(p_href text)
returns boolean
language sql
immutable
parallel safe
as $$
  select p_href is null
      or (
        length(p_href) between 1 and 2048
        and p_href ~ '^(https://|/)'
        and p_href !~* '^[[:space:]]*(javascript|data|vbscript):'
      );
$$;

comment on function public.is_safe_link_href(text) is
  'CHECK-constraint helper for CMS link targets. Site-relative or https only.';

revoke execute on function public.set_updated_at() from public;
