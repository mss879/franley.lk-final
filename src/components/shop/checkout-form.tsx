"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Banknote, CreditCard, Landmark, Loader2 } from "lucide-react";
import { useCart } from "@/lib/cart/cart-context";
import { SL_DISTRICTS, type PaymentMethod } from "@/lib/checkout/schema";
import { formatPrice, cn } from "@/lib/utils";
import { useSiteSettings } from "@/lib/settings/provider";
import { shippingFor, waLink } from "@/lib/settings/shipping";
import { ButtonLink } from "@/components/ui/button";
import { redirectToPayHere } from "@/lib/payhere/redirect";

type FieldErrors = Record<string, string>;

/**
 * The card order this tab last sent to PayHere. Pressing Back on PayHere's
 * page (or its "Go Back" on an error) returns the shopper HERE, not to the
 * order page, with an emptied bag — and the unpaid order still holding stock.
 * Remembering it lets the empty checkout offer the way back instead.
 */
const PENDING_KEY = "franley.pendingPayment";
type PendingPayment = { orderNumber: string; token: string; at: number };

function readPending(): PendingPayment | null {
  if (typeof window === "undefined") return null;
  try {
    const p = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? "null") as PendingPayment | null;
    if (p?.orderNumber && p.token && Date.now() - p.at < 24 * 60 * 60 * 1000) return p;
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* storage blocked: nothing to offer */
  }
  return null;
}

function PendingPaymentNotice({ pending, compact = false }: { pending: PendingPayment; compact?: boolean }) {
  const href = `/order/${encodeURIComponent(pending.orderNumber)}?token=${encodeURIComponent(pending.token)}`;
  return (
    <div role="status" className={cn("rounded-2xl border border-wine-700/25 bg-wine-50 px-5 py-4 text-left", compact ? "mb-8" : "mx-auto mb-8 max-w-md")}>
      <p className="text-sm font-medium text-wine-800">You started paying for order {pending.orderNumber}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-600">
        If that payment did not go through, finish it on the order page rather than ordering again — the pieces are
        held for you.
      </p>
      <Link href={href} className="mt-3 inline-block text-xs font-medium text-wine-700 underline underline-offset-4 hover:text-wine-600">
        Go to order {pending.orderNumber}
      </Link>
    </div>
  );
}

const PAYMENTS: { value: PaymentMethod; label: string; note: string; Icon: typeof Banknote }[] = [
  { value: "card", label: "Pay online", note: "Visa, Mastercard, Amex and local wallets — paid securely through PayHere.", Icon: CreditCard },
  { value: "cod", label: "Cash on delivery", note: "Pay the courier when your order arrives.", Icon: Banknote },
  { value: "bank_transfer", label: "Bank transfer", note: "We send account details right after you order.", Icon: Landmark },
];

export function CheckoutForm({ cardEnabled = false }: { cardEnabled?: boolean }) {
  const { lines, subtotalCents, clear, remove, ready } = useCart();
  const settings = useSiteSettings();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  // /api/checkout reads x-idempotency-key and hands it to place_order so a
  // retried submission returns the original order instead of creating a second
  // one. The form never sent it, so that protection was unreachable and a
  // retry after a network timeout made a duplicate real order. One key per
  // checkout attempt, regenerated only once an order actually succeeds.
  const idempotencyKey = useRef<string | null>(null);
  const payments = useMemo(() => PAYMENTS.filter((p) => cardEnabled || p.value !== "card"), [cardEnabled]);
  const [payment, setPayment] = useState<PaymentMethod>("cod");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Set when the server says this submission already placed an order.
  const [placed, setPlaced] = useState<{ orderNumber: string; awaitingPayment: boolean } | null>(null);
  // Read once on the client; nothing that uses it renders before the bag has
  // loaded, so the server's null never has to match.
  const [pending] = useState(readPending);

  // The same rule place_order charges, read from the admin's settings.
  const shipping = useMemo(() => shippingFor(subtotalCents, settings), [subtotalCents, settings]);

  if (placed) {
    return (
      <div role="status" className="mx-auto max-w-xl rounded-3xl border border-cream-300 bg-cream-100 px-8 py-14 text-center">
        <p className="font-display text-3xl">Order {placed.orderNumber} is already placed</p>
        <p className="mt-4 text-sm leading-relaxed text-ink-600">
          {placed.awaitingPayment
            ? "We received this order a moment ago, but it has not been paid yet. Message us on WhatsApp with the order number and we will send you a payment link or switch it to cash on delivery."
            : "We received this order a moment ago — there is no need to place it again. Your confirmation email has the link to track it."}
        </p>
        <ButtonLink
          href={waLink(settings.whatsapp, `Hi Franley, about order ${placed.orderNumber}`)}
          size="lg"
          className="mt-7"
        >
          Message us on WhatsApp
        </ButtonLink>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="py-24 text-center text-sm text-ink-600" role="status" aria-busy="true">
        Loading your bag…
      </div>
    );
  }

  if (!lines.length) {
    return (
      <div className="rounded-3xl border border-dashed border-cream-300 py-24 text-center">
        {/* e.g. the stale-bag notice, when removing those lines emptied the bag */}
        {formError && (
          <p role="alert" className="mx-auto mb-8 max-w-md rounded-2xl bg-wine-700/10 px-4 py-3 text-xs text-wine-800">
            {formError}
          </p>
        )}
        {pending && <PendingPaymentNotice pending={pending} />}
        <p className="font-display text-3xl">Nothing to check out</p>
        <p className="mt-3 text-sm text-ink-600">Add a piece to your bag first.</p>
        <ButtonLink href="/shop" size="lg" className="mt-7">Browse the collection</ButtonLink>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});
    setFormError(null);

    if (!idempotencyKey.current) {
      idempotencyKey.current =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    const fd = new FormData(e.currentTarget);
    const payload = {
      email: String(fd.get("email") ?? ""),
      fullName: String(fd.get("fullName") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      addressLine1: String(fd.get("addressLine1") ?? ""),
      addressLine2: String(fd.get("addressLine2") ?? ""),
      city: String(fd.get("city") ?? ""),
      district: String(fd.get("district") ?? ""),
      postalCode: String(fd.get("postalCode") ?? ""),
      notes: String(fd.get("notes") ?? ""),
      paymentMethod: payment,
      // Prices are deliberately absent — the server recomputes them.
      items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
    };

    let leaving = false;
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": idempotencyKey.current,
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok) {
        // Lines saved before the shop was connected to its database: drop them
        // so the next attempt can succeed, and say why.
        if (Array.isArray(json.staleItems)) {
          for (const id of json.staleItems as string[]) remove(id);
          idempotencyKey.current = null;
        }
        if (json.fieldErrors) {
          setErrors(json.fieldErrors);
          const failed = new Set(Object.keys(json.fieldErrors as FieldErrors));
          requestAnimationFrame(() => {
            Array.from(formRef.current?.querySelectorAll<HTMLElement>("[name]") ?? [])
              .find((el) => failed.has(el.getAttribute("name") ?? ""))
              ?.focus();
          });
        }
        setFormError(json.error ?? "We could not place your order. Please try again.");
        return;
      }

      idempotencyKey.current = null;
      clear();

      // The first attempt got through but its response did not come back.
      // The order link cannot be re-issued (only its hash is stored), so say
      // plainly what happened rather than inviting a second order.
      if (json.duplicate) {
        setPlaced({ orderNumber: json.orderNumber, awaitingPayment: Boolean(json.awaitingPayment) });
        return;
      }

      // A card order exists but is unpaid at this point. Hand the shopper to
      // PayHere; they come back to the order page, which also offers "Pay now"
      // again if they back out. Stay in the submitting state — the page is
      // about to navigate away.
      if (json.payhere) {
        leaving = true;
        try {
          sessionStorage.setItem(
            PENDING_KEY,
            JSON.stringify({ orderNumber: json.orderNumber, token: json.accessToken, at: Date.now() } satisfies PendingPayment),
          );
        } catch {
          /* storage blocked: the order page link in PayHere's cancel URL still works */
        }
        redirectToPayHere(json.payhere);
        return;
      }

      try {
        sessionStorage.removeItem(PENDING_KEY);
      } catch {
        /* nothing to clear */
      }

      router.push(`/order/${json.orderNumber}?token=${encodeURIComponent(json.accessToken)}`);
    } catch {
      setFormError("Network problem — check your connection and try again.");
    } finally {
      if (!leaving) setSubmitting(false);
    }
  }

  // Per-field errors were rendered as loose <p>s that no input referenced, so a
  // screen-reader user who submitted an invalid checkout heard nothing change
  // and had no way to find the bad field. The admin forms already do this
  // properly (see src/components/admin/products/fields.tsx).
  const invalid = (id: string) =>
    errors[id] ? { "aria-invalid": true as const, "aria-describedby": `${id}-error` } : {};

  const field = (id: string) =>
    cn(
      "mt-2 h-12 w-full rounded-full border bg-cream-50 px-5 text-sm transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
      errors[id] ? "border-wine-600" : "border-cream-300 focus-visible:border-wine-700",
    );

  return (
    <>
    {pending && <PendingPaymentNotice pending={pending} compact />}
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
      <div className="space-y-10">
        <fieldset>
          <legend className="font-display text-2xl">Contact</legend>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="email" className="eyebrow block text-ink-600">Email</label>
              <input id="email" name="email" type="email" autoComplete="email" required {...invalid("email")} className={field("email")} />
              {errors.email && <p id="email-error" className="mt-1.5 text-xs text-wine-700">{errors.email}</p>}
            </div>
            <div>
              <label htmlFor="fullName" className="eyebrow block text-ink-600">Full name</label>
              <input id="fullName" name="fullName" autoComplete="name" required {...invalid("fullName")} className={field("fullName")} />
              {errors.fullName && <p id="fullName-error" className="mt-1.5 text-xs text-wine-700">{errors.fullName}</p>}
            </div>
            <div>
              <label htmlFor="phone" className="eyebrow block text-ink-600">Phone</label>
              <input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="077 123 4567" required {...invalid("phone")} className={field("phone")} />
              {errors.phone && <p id="phone-error" className="mt-1.5 text-xs text-wine-700">{errors.phone}</p>}
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend className="font-display text-2xl">Delivery address</legend>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="addressLine1" className="eyebrow block text-ink-600">Street address</label>
              <input id="addressLine1" name="addressLine1" autoComplete="address-line1" required {...invalid("addressLine1")} className={field("addressLine1")} />
              {errors.addressLine1 && <p id="addressLine1-error" className="mt-1.5 text-xs text-wine-700">{errors.addressLine1}</p>}
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="addressLine2" className="eyebrow block text-ink-600">Apartment, floor (optional)</label>
              <input id="addressLine2" name="addressLine2" autoComplete="address-line2" {...invalid("addressLine2")} className={field("addressLine2")} />
            </div>
            <div>
              <label htmlFor="city" className="eyebrow block text-ink-600">City</label>
              <input id="city" name="city" autoComplete="address-level2" required {...invalid("city")} className={field("city")} />
              {errors.city && <p id="city-error" className="mt-1.5 text-xs text-wine-700">{errors.city}</p>}
            </div>
            <div>
              <label htmlFor="district" className="eyebrow block text-ink-600">District</label>
              <select id="district" name="district" required defaultValue="Colombo" {...invalid("district")} className={cn(field("district"), "appearance-none")}>
                {SL_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              {errors.district && <p id="district-error" className="mt-1.5 text-xs text-wine-700">{errors.district}</p>}
            </div>
            <div>
              <label htmlFor="postalCode" className="eyebrow block text-ink-600">Postal code (optional)</label>
              <input id="postalCode" name="postalCode" autoComplete="postal-code" {...invalid("postalCode")} className={field("postalCode")} />
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend className="font-display text-2xl">Payment</legend>
          <div className="mt-6 space-y-3">
            {payments.map(({ value, label, note, Icon }) => (
              <label
                key={value}
                className={cn(
                  "flex cursor-pointer items-start gap-4 rounded-2xl border p-5 transition-colors",
                  payment === value ? "border-wine-700 bg-wine-700/[0.04]" : "border-cream-300 hover:border-ink-400",
                )}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={value}
                  checked={payment === value}
                  onChange={() => setPayment(value)}
                  className="mt-1 h-4 w-4 accent-[#711625] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                />
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-wine-700" strokeWidth={1.5} aria-hidden />
                <span>
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="mt-1 block text-xs text-ink-600">{note}</span>
                  {value === "bank_transfer" && payment === "bank_transfer" && settings.bankTransferDetails && (
                    <span className="mt-3 block whitespace-pre-line rounded-xl bg-cream-50 px-4 py-3 text-xs leading-relaxed text-ink-800">
                      {settings.bankTransferDetails}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>

          <div className="mt-6">
            <label htmlFor="notes" className="eyebrow block text-ink-600">Order notes (optional)</label>
            <textarea id="notes" name="notes" rows={3} className="mt-2 w-full rounded-2xl border border-cream-300 bg-cream-50 px-5 py-4 text-sm focus-visible:border-wine-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]" />
          </div>
        </fieldset>
      </div>

      {/* ---- Summary ---- */}
      <aside className="h-fit rounded-3xl border border-cream-300 bg-cream-100 p-7 lg:sticky lg:top-28">
        <h2 className="font-display text-2xl">Order summary</h2>

        <ul className="mt-6 space-y-4 border-b border-cream-300 pb-6">
          {lines.map((l) => (
            <li key={l.productId} className="flex gap-4">
              <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded-lg border border-cream-300 bg-white">
                {l.image && <Image src={l.image} alt="" fill sizes="56px" className="object-contain p-1" />}
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-wine-700 px-1 text-[10px] text-cream-50">
                  {l.quantity}
                </span>
              </div>
              <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                <span className="truncate text-sm">{l.title}</span>
                <span className="shrink-0 text-sm tabular-nums">{formatPrice(l.priceCents * l.quantity)}</span>
              </div>
            </li>
          ))}
        </ul>

        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-600">Subtotal</dt>
            <dd className="tabular-nums">{formatPrice(subtotalCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-600">Delivery</dt>
            <dd className="tabular-nums">{shipping === 0 ? "Free" : formatPrice(shipping)}</dd>
          </div>
          <div className="flex justify-between border-t border-cream-300 pt-4">
            <dt className="font-display text-lg">Total</dt>
            <dd className="font-display text-lg tabular-nums">{formatPrice(subtotalCents + shipping)}</dd>
          </div>
        </dl>

        {formError && (
          <p role="alert" className="mt-5 rounded-2xl bg-wine-700/10 px-4 py-3 text-xs text-wine-800">
            {formError}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 grid h-14 w-full place-items-center rounded-full bg-wine-700 text-sm font-medium text-cream-50 transition-colors hover:bg-wine-600 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {payment === "card" ? "Taking you to PayHere…" : "Placing order…"}
            </span>
          ) : payment === "card" ? (
            "Continue to payment"
          ) : (
            "Place order"
          )}
        </button>

        <p className="mt-4 text-center text-xs text-ink-600">
          By placing this order you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-wine-700">terms</Link>.
        </p>
      </aside>
    </form>
    </>
  );
}
