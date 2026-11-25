-- =============================================================================
-- 0021_delete_orders.sql
-- FEATURE: The owner can delete an order — but only one that never became a
--          sale. Fake orders, test orders and cancelled orders clutter the
--          admin list and the customer stats; real sales are a financial record
--          and stay for ever.
--
--          admin_delete_order(p_order_id) is the ONLY delete path. There is
--          still no DELETE grant on orders for any application role, and the
--          RESTRICTIVE orders_admin_only policy (0005) is untouched.
--
-- SAFE TO RE-RUN: yes. create or replace, grants re-applied.
--
-- THE RULE — an order may be deleted only when BOTH hold:
--   1. No money was ever received for it:
--        payment_status in ('unpaid', 'pending', 'failed').
--      'paid' and 'refunded' always stay — a refund is money that came in and
--      went back out, and the books need both halves.
--   2. It never became a delivery:
--        status = 'cancelled'
--        or status in ('pending', 'confirmed', 'packed').
--      'shipped', 'delivered' and 'refunded' orders stay. (A cancelled order is
--      deletable whatever it went through before, provided rule 1 holds.)
--   Plus one timing guard: a CARD order (cancelled or not) younger than
--   one hour is refused. The shopper may still be on PayHere's page, and a
--   payment that lands for a deleted order has nowhere to be recorded — the
--   "PAID AFTER CANCELLATION" warning in record_gateway_payment (0012) only
--   works while the row exists.
--
-- WHAT HAPPENS ON DELETE:
--   * Stock: an order that is not yet cancelled still holds its units, so it
--     is first cancelled WITH restock through admin_cancel_order — the one
--     place that owns the restock logic (0006, per-colour since 0018). An order
--     that is already cancelled is not restocked again: that decision was made
--     when it was cancelled.
--   * order_items, order_events, email_log (0011) and admin_push_log (0017) go
--     with it by ON DELETE CASCADE.
--   * The customer row is never deleted; its counts and totals are recomputed
--     with customer_recompute (0014), because trg_orders_customer_stats fires on
--     INSERT/UPDATE only.
--   * The deferred tg_orders_total_matches_items checks queued by the cascade
--     (and by the cancel's UPDATE) find no order at COMMIT and return quietly —
--     that branch exists in 0005 for exactly this.
-- =============================================================================

create or replace function public.admin_delete_order(p_order_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_o         public.orders%rowtype;
  v_restocked boolean := false;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into v_o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  if v_o.payment_status not in ('unpaid', 'pending', 'failed') then
    raise exception 'Order % cannot be deleted: its payment is %. Paid and refunded orders are kept as a financial record.',
      v_o.order_number, v_o.payment_status using errcode = '23514';
  end if;

  if v_o.status not in ('cancelled', 'pending', 'confirmed', 'packed') then
    raise exception 'Order % cannot be deleted: it is already %. Only cancelled or never-paid orders that have not shipped can be deleted.',
      v_o.order_number, v_o.status using errcode = '23514';
  end if;

  if v_o.payment_method = 'card' and v_o.created_at > now() - interval '1 hour' then
    raise exception 'Order % was placed less than an hour ago and the shopper may still be paying on PayHere. Try again later.',
      v_o.order_number using errcode = '23514';
  end if;

  -- Give the units back before the order disappears. admin_cancel_order
  -- re-checks is_admin, takes the product locks in the same order place_order
  -- does, and is idempotent on an order that is already cancelled.
  if v_o.status <> 'cancelled' then
    perform public.admin_cancel_order(p_order_id, true, 'Cancelled before deletion');
    v_restocked := true;
  end if;

  delete from public.orders where id = p_order_id;

  perform public.customer_recompute(v_o.customer_id);

  return jsonb_build_object(
    'order_id',     v_o.id,
    'order_number', v_o.order_number,
    'was_status',   v_o.status,
    'restocked',    v_restocked,
    'deleted',      true);
end;
$$;

revoke execute on function public.admin_delete_order(uuid) from public, anon;
grant  execute on function public.admin_delete_order(uuid) to authenticated;

do $$
begin
  raise notice '0021 applied: admin_delete_order() installed — cancelled or never-paid, unshipped orders can be deleted; paid, refunded and shipped orders cannot.';
end
$$;
