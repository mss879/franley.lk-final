# Franley — Supabase setup

This folder holds the database for **franley.lk**: the products, the categories,
the orders, and the content you can edit from the admin panel.

It is written for someone who has never used a database before. You do not need
to understand the SQL. You need to **paste eleven files, in order, into one box on
a website**, and then create your admin login. That is the whole job. It takes
about fifteen minutes.

---

## Before you start

You need:

1. A Supabase account — free at <https://supabase.com>.
2. This project folder on your computer.
3. The email address and password you want to use to log into the Franley admin.

---

## Step 1 — Create the project

1. Go to <https://supabase.com/dashboard> and click **New project**.
2. Give it a name (`franley` is fine), pick a strong database password, and
   choose the region closest to Sri Lanka — **Singapore (ap-southeast-1)**.
3. Click **Create new project** and wait a minute or two while it starts.

---

## Step 2 — Run the ten migration files, in order

Everything the database needs is in `supabase/migrations/`. There are eleven files.
**Run them in number order — 0001 first, 0011 last.** Each one builds on the one
before it.

1. In the Supabase dashboard, click **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Open `supabase/migrations/0001_init_extensions.sql` in any text editor
   (TextEdit, VS Code, Notepad). Select all the text and copy it.
4. Paste it into the SQL Editor box and click **Run** (or press Cmd/Ctrl + Enter).
5. You should see **Success. No rows returned**, or a short green notice. That
   is what success looks like.
6. Clear the box, and repeat steps 3–5 for `0002`, then `0003`, and so on,
   all the way to `0011`.

Two of the files print a friendly summary when they finish:

* `0008_seed_catalog.sql` prints `Franley catalogue: 4 categories, 49 products, 93 images`
* `0010_guardrails.sql` prints `Franley schema guardrails passed.`

If you see those two lines, the database is correct.

> **If something goes red.** Read the message. If it says something *already
> exists*, that file has already been run — that is harmless, move on to the
> next file. Every one of these files is safe to run more than once: re-running
> them never deletes anything and never overwrites content you have edited in
> the admin. If the message says something else, copy it and send it to your
> developer.

### If you prefer the command line

If you have the Supabase CLI installed, the same eleven files run with:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

`supabase db push` applies them in filename order, which is the correct order.

---

## Step 3 — Create your admin login by hand

There is **no sign-up page** for the admin, on purpose. Nobody can create an
admin account by visiting the website. Admins are created here, by you.

1. In the Supabase dashboard, click **Authentication** in the left sidebar.
2. Click **Users**, then **Add user** → **Create new user**.
3. Enter the email address and password you want to use for the Franley admin.
4. Tick **Auto Confirm User**. (Without this, the login will not work until the
   address is confirmed by email.)
5. Click **Create user**.

You have now created a *login*. It is not an admin yet — that is the next step,
and it is deliberately a separate one.

---

## Step 4 — Make that login an admin

1. Go back to **SQL Editor** → **New query**.
2. Paste this line, replacing the email with the one you just used:

   ```sql
   select public.grant_admin('you@yourdomain.com', 'owner');
   ```

3. Click **Run**. It returns a long ID. That means it worked.

If it says *No auth user with email …*, the address does not match the one you
created in Step 3. Check for typos and try again.

`owner` is the highest level. If you later want to give a staff member access
that cannot manage other admins, use `'admin'` instead of `'owner'`.

**To remove someone's access later:**

```sql
select public.revoke_admin('them@example.com');
```

Their access stops on their very next click — there is no waiting period. The
database refuses to remove the last remaining owner, so you cannot accidentally
lock yourself out of your own shop.

---

## Step 5 — Connect the website to the database

1. In the dashboard, go to **Project Settings** → **API**.
2. Copy the **Project URL** and the **anon public** key.
3. Put them into the `.env.local` file in the project folder:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```

The **anon public** key is meant to be public — it is safe in the browser. The
database decides what it is allowed to see.

> **The `service_role` key is different.** It ignores every security rule in the
> database. Never put it in `.env.local` next to a `NEXT_PUBLIC_` name, never
> paste it into a web page, and never send it over WhatsApp or email. If it ever
> leaks, go to **Project Settings → API → Reset** immediately.

---

## Step 6 — Two settings to change in the dashboard

The database cannot do these for you.

1. **Turn off public sign-ups.** Go to **Authentication** → **Sign In / Up** and
   turn **Allow new users to sign up** OFF, and **Allow anonymous sign-ins** OFF.
   Franley has no customer accounts — shoppers check out as guests — so nobody
   should be able to create a login. Leaving this on is the single most common
   way a small store gets abused.
2. **Turn on two-factor authentication** for your own admin login. Your admin
   account can see every customer's name, phone number and address. Protect it.

---

## What each file does

| File | What it adds |
| --- | --- |
| `0001_init_extensions.sql` | Shared groundwork. No tables. |
| `0002_admin_authz.sql` | Who is an admin, and the `grant_admin` command above. |
| `0003_catalog.sql` | Categories, products, product images. |
| `0004_media_and_cms.sql` | Uploaded images, the editable page content, and site settings. |
| `0005_orders.sql` | Orders, order lines, and the order history log. |
| `0006_rpc_checkout.sql` | Checkout itself, and the admin order actions. |
| `0007_storage_buckets.sql` | The two folders your uploaded images go into. |
| `0008_seed_catalog.sql` | The real catalogue: 4 categories, 49 products, 93 images. |
| `0009_seed_cms.sql` | The homepage wording as it is today, so the admin opens onto real content. |
| `0010_guardrails.sql` | A safety check. Run it again any time. It changes nothing. |
| `0011_email_log.sql` | A record of every order email sent, so a customer is never emailed twice. |

---

## Things you can change yourself, without a developer

All of these live on the **Settings** page of the admin (they are rows in the
`site_settings` table). The important ones:

| Setting | What it does |
| --- | --- |
| Delivery charge | In cents. `35000` means Rs 350.00. |
| Free delivery over | In cents. `500000` means Rs 5,000.00. |
| Accept orders | Turn this off to close checkout — during a stock take, say — without taking the website down. |
| WhatsApp number | Powers the floating WhatsApp button. |
| Bank transfer instructions | Shown at checkout when a customer picks bank transfer. |

The delivery charge is read by the checkout **at the moment the order is placed**,
so the amount a customer is shown and the amount they are charged can never
drift apart.

Page wording and banner images are on the **Content** page of the admin. Each
field has its own label — "Headline", "Hero image", "Button text" — so you never
have to edit anything that looks like code. Anything you leave blank falls back
to the wording built into the site, so a half-finished edit can never leave the
homepage empty.

---

## How the safety rules work, in one paragraph

Every table has row-level security switched on, which means the database itself
decides who may see each row — not the website code. Shoppers can read products,
categories and published content, and nothing else. **Anonymous visitors have no
access to the orders tables at all** — not even to add a row. When someone
checks out, the website calls a single locked function that ignores whatever
prices the browser sent, re-reads the real price from the database, works out
delivery itself, reduces stock, and only then writes the order. The customer
gets back a long random link that is the only way to view that order again;
order numbers are deliberately *not* accepted as passwords, because they are
sequential and guessable. Order totals cannot be edited afterwards by anybody —
not by you, not by the website, not even by someone holding the master key.

---

## Known limits, stated honestly

* **Checkout rate limiting is a speed bump, not a wall.** The database counts
  attempts, but it can only see the address the request claims to come from. Real
  protection needs a bot check (Cloudflare Turnstile or similar) in front of the
  checkout button.
* **Stock is reduced the moment an order is placed.** Somebody placing fake
  cash-on-delivery orders can therefore drain your stock counts. Cancelling
  those orders in the admin puts the stock straight back.
* **The customer's order link cannot be resent.** It is shown on the confirmation
  page and emailed once. There is no "email me my link again" feature, because
  building one would let a stranger ask questions about other people's orders.
* **Product web addresses are the ones the old Shopify store used**, including
  the ones that are just numbers (`/products/41`). Changing them later breaks
  any Google result pointing at them, so decide before launch, not after.
* **Deleted images stay in storage.** Removing an image from a product does not
  remove the file from the bucket. Harmless at this size, but it accumulates.

---

## Troubleshooting

**"permission denied for table orders"** — you are logged in, but that login is
not an admin. Re-run Step 4 with the exact email address of the login you are
using.

**The admin loads but every list is empty** — the login is not an admin (Step 4),
or `.env.local` points at a different project (Step 5).

**The storefront shows the built-in demo products instead of the real ones** —
`NEXT_PUBLIC_SUPABASE_URL` is missing or still contains `YOUR-PROJECT-REF`.

**A migration says "already exists"** — that file has already been run. Skip it
and carry on with the next number.

**You want to check everything is still safe** — open the SQL Editor and re-run
`0010_guardrails.sql`. It changes nothing and prints either
`Franley schema guardrails passed.` or an exact list of what is wrong. Run it
after any future change to the database.
