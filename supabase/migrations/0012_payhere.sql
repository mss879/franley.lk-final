-- =============================================================================
-- 0012_payhere.sql
-- FEATURE: Online card payments through PayHere (payhere.lk).
--
-- SAFE TO RE-RUN: yes.
--
-- WHAT THIS ADDS:
--   * Four nullable columns on orders that say which gateway took the money,
--     the gateway's own payment id, how the customer paid (VISA, MASTER, …) and
--     when. None of them is covered by tg_orders_immutable_money, which freezes
--     the amounts only.
--   * record_gateway_payment() — the single write path a payment gateway has
--     into orders.payment_status.
--
-- WHY A NEW FUNCTION AND NOT admin_set_payment_status:
--   That one begins with is_admin(), and the caller here is not a person. It is
--   the /api/payments/payhere/notify route, which has already verified
--   PayHere's md5sig against the merchant secret and then connects with the
--   service-role key. So this function is granted to service_role ONLY — anon
--   and authenticated cannot execute it, and a shopper can never mark their own
--   order paid.
--
--   Its rules also differ from an admin's. A gateway's notifications can arrive
--   late, twice, or out of order, so:
--     - the same status twice is a no-op (idempotent);
--     - a 'failed' or 'pending' that arrives after 'paid' is ignored — a retry
--       that succeeded must not be undone by the earlier attempt's failure;
--     - 'paid' is only accepted when the amount and currency PayHere reports
--       match the order's frozen total exactly.
-- =============================================================================

alter table public.orders
  add column if not exists payment_gateway       text
    check (payment_gateway is null or payment_gateway in ('payhere')),
  add column if not exists payment_reference     text
    check (payment_reference is null or length(payment_reference) <= 100),
  add column if not exists payment_method_detail text
    check (payment_method_detail is null or length(payment_method_detail) <= 40),
  add column if not exists paid_at               timestamptz;

comment on column public.orders.payment_reference is
  'The gateway''s own id for the payment (PayHere payment_id). Quote it to PayHere support, and use it to refund.';

create index if not exists orders_payment_reference_idx
  on public.orders (payment_reference) where payment_reference is not null;

create or replace function public.record_gateway_payment(
  p_order_number  text,
  p_gateway       text,
  p_status        public.payment_status,
  p_amount_cents  integer,
  p_currency      text,
  p_reference     text default null,
  p_method_detail text default null,
  p_message       text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_o        public.orders%rowtype;
  v_note     text;
  v_confirm  boolean;
begin
  if p_gateway is distinct from 'payhere' then
    raise exception 'Unknown payment gateway' using errcode = '22023';
  end if;
  if p_status not in ('pending','paid','failed','refunded') then
    raise exception 'A gateway cannot set payment to %', p_status using errcode = '22023';
  end if;

  select * into v_o from public.orders
   where order_number = upper(p_order_number) for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  if v_o.payment_method <> 'card' then
    raise exception 'Order % is not a card order', v_o.order_number using errcode = '22023';
  end if;

  -- The amounts on an order are frozen at placement. Money that does not match
  -- them to the cent is not payment for this order.
  if p_status = 'paid'
     and (p_amount_cents is distinct from v_o.total_cents
          or upper(p_currency) is distinct from v_o.currency::text) then
    raise exception 'Payment of % % does not match order total % %',
      p_amount_cents, p_currency, v_o.total_cents, v_o.currency
      using errcode = '23514';
  end if;

  if v_o.payment_status = p_status then
    return jsonb_build_object('order_id', v_o.id, 'order_number', v_o.order_number,
                              'payment_status', v_o.payment_status, 'changed', false);
  end if;

  -- Once money is in, only a refund/chargeback moves it. Once refunded, nothing does.
  if (v_o.payment_status = 'paid' and p_status <> 'refunded')
     or v_o.payment_status = 'refunded'
     or (p_status = 'refunded' and v_o.payment_status <> 'paid') then
    return jsonb_build_object('order_id', v_o.id, 'order_number', v_o.order_number,
                              'payment_status', v_o.payment_status,
                              'changed', false, 'ignored', true);
  end if;

  -- A paid order no longer needs a person to confirm it.
  v_confirm := p_status = 'paid' and v_o.status = 'pending';

  update public.orders
     set payment_status        = p_status,
         payment_gateway       = p_gateway,
         payment_reference     = coalesce(left(p_reference, 100), payment_reference),
         payment_method_detail = coalesce(left(p_method_detail, 40), payment_method_detail),
         paid_at               = case when p_status = 'paid' then now() else paid_at end,
         status                = case when v_confirm then 'confirmed'::public.order_status else status end,
         confirmed_at          = case when v_confirm then now() else confirmed_at end
   where id = v_o.id;

  v_note := 'PayHere: ' || p_status::text
         || coalesce(' via ' || nullif(p_method_detail, ''), '')
         || coalesce(' (payment ' || nullif(p_reference, '') || ')', '')
         || coalesce(' — ' || nullif(p_message, ''), '');

  -- The shelf was restocked when this order was cancelled, and the customer has
  -- now been charged for it anyway. Someone has to see that.
  if p_status = 'paid' and v_o.status = 'cancelled' then
    v_note := 'PAID AFTER CANCELLATION — refund this payment in PayHere. ' || v_note;
  end if;

  insert into public.order_events (order_id, from_status, to_status, actor_kind, actor_user_id, note)
  values (v_o.id, v_o.status,
          case when v_confirm then 'confirmed'::public.order_status else v_o.status end,
          'system', null, left(v_note, 500));

  return jsonb_build_object('order_id', v_o.id, 'order_number', v_o.order_number,
                            'payment_status', p_status, 'changed', true,
                            'confirmed', v_confirm);
end;
$$;

revoke execute on function public.record_gateway_payment(text, text, public.payment_status, integer, text, text, text, text)
  from public, anon, authenticated;
grant  execute on function public.record_gateway_payment(text, text, public.payment_status, integer, text, text, text, text)
  to service_role;
