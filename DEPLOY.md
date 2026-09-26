# Going live at franley.lk

Do these in order. Steps 1–3 must happen before anyone visits the site;
steps 4–6 can follow the same day.

---

## 1. Supabase — the database

Follow **[supabase/README.md](supabase/README.md)** end to end. It covers
creating the project, running the sixteen migration files in order (then
`0010_guardrails.sql` once more), creating your admin login by hand, and the two
dashboard settings that must be changed.

When you finish, `select public.grant_admin('you@franley.lk', 'owner');` should
have returned an id, and **Allow new users to sign up** must be **OFF**.

---

## 2. Resend — order emails

1. Sign up at <https://resend.com> and go to **Domains → Add Domain**.
2. Add `franley.lk`. Resend gives you three DNS records — an MX, and two TXT
   records for DKIM and SPF. Add them at your domain registrar.
3. Wait for the domain to show **Verified**. This usually takes minutes but can
   take a few hours.
4. Go to **API Keys → Create API Key**, with **Sending access** only.

> **Why a verified domain matters.** Sending from an unverified domain puts your
> order confirmations in spam, and customers conclude the order failed and
> either order twice or not at all. Do not skip the DNS records.

---

## 2b. PayHere — card payments

Skip this and checkout offers cash on delivery and bank transfer only.

The store uses PayHere's **live** system only — there is no sandbox mode. Every
card payment is real money.

1. In the live account at <https://www.payhere.lk>, open **Integrations**, note
   the **Merchant ID**, click **Add Domain/App**, enter `franley.lk` and wait for
   approval (up to 24 hours). Copy the **Merchant Secret** shown against it.
2. Set `PAYHERE_MERCHANT_ID` and `PAYHERE_MERCHANT_SECRET` on your host.
3. The migration `0012_payhere.sql` must have been run (section 1), and
   `SUPABASE_SERVICE_ROLE_KEY` must be set — it is what records a payment.

Card payment only works from the approved domain. Checkout from `localhost` or a
Netlify preview address is refused by PayHere (PH-0013) — that is expected.

### Go-live checklist (live PayHere account)

- [ ] `franley.lk` added under **Integrations** in the **live** account and shown
      as approved. `PAYHERE_MERCHANT_SECRET` is the secret shown against it.
- [ ] `NEXT_PUBLIC_SITE_URL=https://franley.lk` (or unset — it falls back to
      that). The return, cancel and notify addresses PayHere is given are
      built from it.
- [ ] `PAYHERE_NOTIFY_URL` is **not** set. It is for local tunnel testing only.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set. Without it, PayHere takes the money
      and the order is never marked paid.
- [ ] Optional — refunds and payment lookups from the admin: create an API key
      in the **live** account (Settings → API Keys, tick "Automated Charging
      API", allowed domain `franley.lk`) and set `PAYHERE_APP_ID` /
      `PAYHERE_APP_SECRET`. PayHere also requires the server's outbound IP
      address to be whitelisted: email it to support@payhere.lk. Netlify has no
      fixed outbound IP unless you set one up, so until then those two features
      are refused by PayHere — nothing else is affected, and you refund in the
      PayHere dashboard instead.
- [ ] Place one small real card order, see it marked **Paid** in the admin with
      the PayHere payment ID, then refund it.

How it works: the customer is sent to PayHere's own page to pay, so no card
details ever reach this site. PayHere then calls
`https://franley.lk/api/payments/payhere/notify` to say the payment succeeded;
the site checks that message's signature against your Merchant Secret and only
then marks the order **paid** and sends the confirmation emails. If that call is
ever missed, the optional App ID and App Secret let the site ask PayHere
directly when the customer returns.

> **The Merchant Secret is as sensitive as the service-role key.** Anyone who
> has it can forge a "payment received" message. Server-side only, never in a
> `NEXT_PUBLIC_` variable.

**Refunds.** On a paid card order the admin shows **Refund via PayHere**,
which refunds the full amount through PayHere's Refund API, records the refund
number on the order and can cancel it with restock in the same step. It needs
`PAYHERE_APP_ID` / `PAYHERE_APP_SECRET` (and, on live, the IP whitelist above).
Without them, refund in the PayHere dashboard and mark the payment refunded in
the admin. A chargeback PayHere reports marks the payment refunded by itself.

**Abandoned card payments.** A card order takes its stock when it is placed. If
the shopper never pays, it holds that stock until released: **Orders → Awaiting
card payment → Release and restock** cancels every unpaid card order older than
the hours you choose.

---

## 3. Environment variables

Set these on your host (Netlify: Site configuration → Environment variables).
Everything in `.env.example` is documented there too.

Tick **Contains secret values** on `SUPABASE_SERVICE_ROLE_KEY`,
`PAYHERE_MERCHANT_SECRET`, `PAYHERE_APP_SECRET` and `RESEND_API_KEY`. Netlify
then scans every build and refuses to deploy one that would publish a secret.
Changing a variable only takes effect on the next deploy.

| Variable | Value | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | for live data |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the **anon public** key | for live data |
| `SUPABASE_SERVICE_ROLE_KEY` | the **service_role** (secret) key | **yes** — checkout places every order with it; also order emails and card payments |
| `NEXT_PUBLIC_SITE_URL` | `https://franley.lk` | yes |
| `RESEND_API_KEY` | `re_...` | for order emails |
| `RESEND_FROM_EMAIL` | `Franley <orders@franley.lk>` | for order emails |
| `RESEND_REPLY_TO` | `support@franley.lk` | optional |
| `ORDER_NOTIFICATION_EMAIL` | who gets the new-order alert | optional |
| `PAYHERE_MERCHANT_ID` | PayHere → Integrations | for card payments |
| `PAYHERE_MERCHANT_SECRET` | the secret shown against your approved domain | for card payments |
| `PAYHERE_APP_ID` / `PAYHERE_APP_SECRET` | PayHere → Settings → API Keys | optional: refunds + payment lookup |
| `PAYHERE_NOTIFY_URL` | a tunnel URL | local testing only — never in production |

**`SUPABASE_SERVICE_ROLE_KEY` bypasses every security rule in the database.**
It must never appear in a `NEXT_PUBLIC_` variable, in the browser, or in a
screenshot. If it leaks, reset it in Supabase immediately.

The site boots without any of these and serves the bundled seed catalogue, so a
missing variable never takes the shop down — but `/admin` stays locked and no
emails are sent. Missing variables are logged at startup.

---

## 4. Deploy

```bash
npm run build
```

Point `franley.lk` and `www.franley.lk` at the host. Make sure HTTPS is on
before the first visitor: the app sends a two-year `Strict-Transport-Security`
header, which browsers remember.

---

## 5. Verify, in this order

- [ ] `https://franley.lk` loads and shows real products, not the seed fallback.
      (Change a price in the admin; if the storefront follows within a minute,
      you are on live data.)
- [ ] `https://franley.lk/admin/login` — sign in with the account from step 1.
- [ ] **Place one real test order.** Then check that:
      the confirmation email arrived and is not in spam;
      the new-order alert reached `ORDER_NOTIFICATION_EMAIL`;
      the order appears in `/admin/orders`;
      the stock on that product went down by the quantity ordered;
      the **Notifications** card on the order shows both emails as *Sent*.
- [ ] Mark that order **shipped** and confirm the shipped email arrives.
- [ ] Cancel it with restock ticked, confirm the cancellation email arrives and
      the stock comes back.
- [ ] **Customers** in the admin lists the person who placed that order.
- [ ] **Settings**: fill in the bank transfer instructions, change the delivery
      charge, and check the new amount appears in the bag and at checkout. Put
      it back afterwards.
- [ ] `https://franley.lk/collections/featured` and
      `https://franley.lk/collections/neckties` both load.
- [ ] A card order: see section 2b's go-live checklist.
- [ ] `https://franley.lk/sitemap.xml` lists every product.
- [ ] `https://franley.lk/robots.txt` disallows `/admin` and `/checkout`.
- [ ] An old Shopify link such as `franley.lk/policies/refund-policy` redirects
      to `/returns`.

---

## 6. Search engines

1. **Google Search Console** → add `franley.lk` as a domain property, verify by
   DNS, submit `https://franley.lk/sitemap.xml`.
2. **Rich Results Test** (<https://search.google.com/test/rich-results>) on one
   product URL. It should report a valid **Product** with price, availability
   and a return policy, plus **BreadcrumbList**.
3. **Google Business Profile** for the Dehiwala address. The site already
   publishes matching `LocalBusiness` data, and the two reinforce each other for
   local searches in Sri Lanka.

---

## Things to know

**Product URLs are the Shopify ones** — `/products/41`, `/products/38`. They are
ugly but they are what any existing link points at. If you want readable slugs,
change them **before** launch; afterwards it needs a redirect for every product.

**Stock is decremented at checkout**, inside the same database transaction that
creates the order and under a row lock, so two people buying the last tie at the
same moment cannot both succeed.

**Prices are never trusted from the browser.** Checkout sends product ids and
quantities only; every price and the total are recomputed server-side.

**Emails are exactly-once.** A retried checkout cannot email a customer twice —
the send claims a row in `email_log` before calling Resend.

**Backups.** Supabase's free tier keeps 7 days of point-in-time recovery. Once
real orders are coming in, that is worth upgrading.
