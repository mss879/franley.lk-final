import { cn } from "@/lib/utils";
import {
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  type OrderStatus,
  type PaymentStatus,
} from "./status";

/**
 * Progression is carried by weight, not by hue: a light wine tint early, solid
 * wine while the order is moving, solid ink once it has landed, and the two
 * terminal states drained of colour.
 */
const ORDER_TONES: Record<OrderStatus, string> = {
  pending: "border-champagne-400 bg-champagne-200 text-ink-800",
  confirmed: "border-wine-200 bg-wine-50 text-wine-700",
  packed: "border-wine-300 bg-wine-100 text-wine-800",
  shipped: "border-wine-700 bg-wine-700 text-cream-50",
  delivered: "border-ink-900 bg-ink-900 text-cream-50",
  cancelled: "border-cream-300 bg-cream-200 text-ink-600",
  refunded: "border-dashed border-wine-400 bg-wine-50 text-wine-700",
};

const PAYMENT_TONES: Record<PaymentStatus, string> = {
  unpaid: "border-cream-300 bg-cream-100 text-ink-600",
  pending: "border-champagne-400 bg-champagne-100 text-ink-800",
  paid: "border-wine-200 bg-wine-50 text-wine-700",
  refunded: "border-dashed border-ink-400 bg-cream-100 text-ink-600",
  failed: "border-wine-400 bg-wine-100 text-wine-800",
};

const base =
  "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium leading-none tracking-wide whitespace-nowrap";

export function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  return <span className={cn(base, ORDER_TONES[status], className)}>{ORDER_STATUS_LABEL[status]}</span>;
}

export function PaymentStatusBadge({
  status,
  className,
}: {
  status: PaymentStatus;
  className?: string;
}) {
  return (
    <span className={cn(base, "px-2.5 py-0.5", PAYMENT_TONES[status], className)}>
      {PAYMENT_STATUS_LABEL[status]}
    </span>
  );
}
