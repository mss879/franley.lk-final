import type { OrderStatus, PaymentMethod, PaymentView } from "./status";

/** Every list control is a plain link, so the filtered view is shareable and
 *  the back button behaves. Page 1 is left out of the query string. */
export function ordersHref({
  status,
  q,
  page,
  pay,
  method,
}: {
  status?: OrderStatus;
  q?: string;
  page?: number;
  pay?: PaymentView;
  method?: PaymentMethod;
} = {}) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (pay) params.set("pay", pay);
  if (method) params.set("method", method);
  if (q) params.set("q", q);
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/orders?${query}` : "/admin/orders";
}
