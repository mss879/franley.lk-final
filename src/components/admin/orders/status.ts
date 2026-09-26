/** Order vocabulary, mirrored from the enums in 0001 and the transition table
 *  in `admin_update_order_status` (0006). Shared by the pages and the client
 *  controls, so it is a plain module with no server-only imports. */

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ["unpaid", "pending", "paid", "refunded", "failed"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ["cod", "bank_transfer", "card"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  pending: "Payment pending",
  paid: "Paid",
  refunded: "Refunded",
  failed: "Payment failed",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cod: "Cash on delivery",
  bank_transfer: "Bank transfer",
  card: "Card",
};

/**
 * The forward moves the database will accept. `cancelled` is deliberately
 * absent from every list: admin_update_order_status would cancel without
 * returning stock, so cancellation goes through admin_cancel_order instead.
 */
export const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed"],
  confirmed: ["packed", "shipped"],
  packed: ["shipped"],
  shipped: ["delivered"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

/** admin_cancel_order refuses delivered and refunded orders, and no-ops on an
 *  order that is already cancelled. */
export const CANCELLABLE_STATUSES: OrderStatus[] = ["pending", "confirmed", "packed", "shipped"];

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

/**
 * Payment filters on the orders list. "awaiting" is the one that matters for
 * card orders: placed, stock taken, but PayHere has not confirmed the money —
 * they hold stock until paid or released.
 */
export const PAYMENT_VIEWS = ["awaiting", "unpaid", "paid", "refunded", "failed"] as const;
export type PaymentView = (typeof PAYMENT_VIEWS)[number];

export const PAYMENT_VIEW_LABEL: Record<PaymentView, string> = {
  awaiting: "Awaiting card payment",
  unpaid: "Unpaid",
  paid: "Paid",
  refunded: "Refunded",
  failed: "Payment failed",
};

export function isPaymentView(value: string): value is PaymentView {
  return (PAYMENT_VIEWS as readonly string[]).includes(value);
}

export function isPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value);
}

/** The verb on the button that moves an order into a status. */
export const ADVANCE_VERB: Record<OrderStatus, string> = {
  pending: "Reopen",
  confirmed: "Confirm order",
  packed: "Mark packed",
  shipped: "Mark shipped",
  delivered: "Mark delivered",
  cancelled: "Cancel order",
  refunded: "Mark refunded",
};
