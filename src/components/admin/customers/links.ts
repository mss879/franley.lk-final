/** The customers list's controls are plain links, like the orders list's, so a
 *  sorted or searched view is shareable and the back button behaves. */

export const CUSTOMER_SORTS = ["last", "spend", "orders", "name"] as const;
export type CustomerSort = (typeof CUSTOMER_SORTS)[number];

export const DEFAULT_CUSTOMER_SORT: CustomerSort = "last";

export const CUSTOMER_SORT_LABEL: Record<CustomerSort, string> = {
  last: "Last order",
  spend: "Most spent",
  orders: "Most orders",
  name: "Name",
};

export function isCustomerSort(value: string): value is CustomerSort {
  return (CUSTOMER_SORTS as readonly string[]).includes(value);
}

/** The default sort and page 1 are left out of the query string. */
export function customersHref({
  q,
  sort,
  page,
}: {
  q?: string;
  sort?: CustomerSort;
  page?: number;
} = {}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (sort && sort !== DEFAULT_CUSTOMER_SORT) params.set("sort", sort);
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/customers?${query}` : "/admin/customers";
}
