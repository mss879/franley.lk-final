/** Asia/Colombo is a fixed +05:30 offset with no DST, so a day boundary can be
 *  found by shifting the instant rather than by parsing a formatted date. */
const COLOMBO_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function colomboParts(now: Date) {
  const shifted = new Date(now.getTime() + COLOMBO_OFFSET_MS);
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth(), d: shifted.getUTCDate() };
}

export function colomboDayStartISO(now = new Date()) {
  const { y, m, d } = colomboParts(now);
  return new Date(Date.UTC(y, m, d) - COLOMBO_OFFSET_MS).toISOString();
}

export function colomboMonthStartISO(now = new Date()) {
  const { y, m } = colomboParts(now);
  return new Date(Date.UTC(y, m, 1) - COLOMBO_OFFSET_MS).toISOString();
}

const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Colombo",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const DATE_ONLY = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Colombo",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return DATE_TIME.format(new Date(iso)).replace(",", "");
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return DATE_ONLY.format(new Date(iso));
}

export function monthLabel(now = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Colombo", month: "long" }).format(now);
}

/** wa.me wants a bare international number. Sri Lankan numbers are commonly
 *  stored in local 0xxxxxxxxx form, so a leading zero becomes the 94 prefix —
 *  unless the customer typed a '+', in which case the digits are already
 *  international and are left alone. */
export function whatsappHref(phone: string, text?: string) {
  const digits = phone.replace(/\D/g, "");
  const intl =
    phone.trim().startsWith("+") || digits.startsWith("94")
      ? digits
      : `94${digits.replace(/^0+/, "")}`;
  return `https://wa.me/${intl}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
