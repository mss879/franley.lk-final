# Going live at franley.lk

Do these in order. Steps 1–3 must happen before anyone visits the site;
steps 4–6 can follow the same day.

---

## 1. Supabase — the database

Follow **[supabase/README.md](supabase/README.md)** end to end. It covers
creating the project, running the eleven migration files in order, creating your
admin login by hand, and the two dashboard settings that must be changed.

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

## 3. Environment variables

Set these on your host (Vercel: Project → Settings → Environment Variables).
Everything in `.env.example` is documented there too.

| Variable | Value | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | for live data |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the **anon public** key | for live data |
| `SUPABASE_SERVICE_ROLE_KEY` | the **service_role** key | for order emails |
| `NEXT_PUBLIC_SITE_URL` | `https://franley.lk` | yes |
| `RESEND_API_KEY` | `re_...` | for order emails |
| `RESEND_FROM_EMAIL` | `Franley <orders@franley.lk>` | for order emails |
| `RESEND_REPLY_TO` | `support@franley.lk` | optional |
| `ORDER_NOTIFICATION_EMAIL` | who gets the new-order alert | optional |

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
