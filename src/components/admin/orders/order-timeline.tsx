import { ORDER_STATUS_LABEL, type OrderStatus } from "./status";
import { formatDateTime } from "./format";

export type OrderEvent = {
  id: number;
  from_status: OrderStatus | null;
  to_status: OrderStatus | null;
  actor_kind: "system" | "admin" | "customer";
  note: string | null;
  created_at: string;
};

const ACTOR_LABEL: Record<OrderEvent["actor_kind"], string> = {
  system: "System",
  admin: "Admin",
  customer: "Customer",
};

function describe(event: OrderEvent) {
  const to = event.to_status ? ORDER_STATUS_LABEL[event.to_status] : null;
  if (event.from_status && to) {
    return `${ORDER_STATUS_LABEL[event.from_status]} to ${to.toLowerCase()}`;
  }
  if (to) return `Placed as ${to.toLowerCase()}`;
  return "Updated";
}

export function OrderTimeline({ events }: { events: OrderEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-ink-600">Nothing recorded against this order yet.</p>;
  }

  return (
    <ol className="relative space-y-6 border-l border-cream-300 pl-6">
      {events.map((event, i) => (
        <li key={event.id} className="relative">
          <span
            aria-hidden
            className={
              i === 0
                ? "absolute -left-[1.9375rem] top-1 h-2.5 w-2.5 rounded-full bg-wine-700 ring-4 ring-cream-50"
                : "absolute -left-[1.8125rem] top-[0.4375rem] h-1.5 w-1.5 rounded-full bg-cream-300 ring-4 ring-cream-50"
            }
          />
          <p className="text-sm text-ink-800">{describe(event)}</p>
          {event.note && (
            <p className="mt-1 text-xs leading-relaxed text-ink-600">{event.note}</p>
          )}
          <p className="mt-1 text-xs text-ink-600">
            {formatDateTime(event.created_at)} · {ACTOR_LABEL[event.actor_kind]}
          </p>
        </li>
      ))}
    </ol>
  );
}
