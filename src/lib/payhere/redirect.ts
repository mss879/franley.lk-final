/** What /api/checkout and /api/payments/payhere/session hand back for a card order. */
export type PayHereCheckout = { action: string; fields: Record<string, string> };

/**
 * Sends the shopper to PayHere's hosted payment page. PayHere's Checkout API is
 * a browser form POST, so this builds the form and submits it — the page
 * navigates away and does not come back until the payment is done or cancelled.
 *
 * The CSP's form-action (next.config.ts) has to allow the PayHere host, or the
 * browser silently refuses the submit.
 */
export function redirectToPayHere({ action, fields }: PayHereCheckout) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = action;
  form.style.display = "none";
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}
