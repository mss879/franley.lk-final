import { Mail, CircleCheck, CircleAlert, Clock } from "lucide-react";

export type EmailLogRow = {
  id: string;
  kind: string;
  recipient: string;
  subject: string;
  status: "pending" | "sent" | "failed";
  sent_at: string | null;
  created_at: string;
  error: string | null;
};

const KIND_LABEL: Record<string, string> = {
  order_confirmation: "Order confirmation",
  order_admin_alert: "New-order alert",
  order_shipped: "Shipped notification",
  order_delivered: "Delivered notification",
  order_cancelled: "Cancellation notice",
};

const STATUS = {
  sent: { Icon: CircleCheck, className: "text-wine-700", label: "Sent" },
  pending: { Icon: Clock, className: "text-ink-400", label: "Sending" },
  failed: { Icon: CircleAlert, className: "text-wine-600", label: "Failed" },
} as const;

/** What the customer has actually been told about this order, and when. */
export function EmailLog({ rows, enabled }: { rows: EmailLogRow[]; enabled: boolean }) {
  if (!enabled) {
    return (
      <p className="text-sm leading-relaxed text-ink-600">
        Email is not configured, so no notifications were sent. Add{" "}
        <code className="rounded bg-cream-200 px-1.5 py-0.5 text-xs">RESEND_API_KEY</code> and{" "}
        <code className="rounded bg-cream-200 px-1.5 py-0.5 text-xs">RESEND_FROM_EMAIL</code> to
        turn it on.
      </p>
    );
  }

  if (!rows.length) {
    return <p className="text-sm text-ink-600">Nothing sent for this order yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const state = STATUS[row.status];
        const when = row.sent_at ?? row.created_at;
        return (
          <li key={row.id} className="flex gap-3">
            <state.Icon
              className={`mt-0.5 h-4 w-4 shrink-0 ${state.className}`}
              strokeWidth={1.5}
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-sm text-ink-900">
                {KIND_LABEL[row.kind] ?? row.kind}
                <span className="ml-2 text-xs text-ink-600">{state.label}</span>
              </p>
              <p className="mt-0.5 truncate text-xs text-ink-600">{row.recipient}</p>
              <p className="mt-0.5 text-xs text-ink-600">
                <time dateTime={when}>
                  {new Date(when).toLocaleString("en-LK", {
                    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                  })}
                </time>
              </p>
              {row.status === "failed" && row.error && (
                <p className="mt-1 rounded-lg bg-wine-700/8 px-2.5 py-1.5 text-xs text-wine-800">
                  {row.error}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function EmailLogHeading() {
  return (
    <span className="inline-flex items-center gap-2">
      <Mail className="h-4 w-4" strokeWidth={1.5} aria-hidden />
      Notifications
    </span>
  );
}
