# Coffee Kingdom Rewards — setup guide

This is the "buy 5 coffees, get 7" loyalty app. It's an installable web app (PWA)
that lives at **`/app`** on the Coffee Kingdom site. Customers create an account,
buy a bundle by card, and redeem coffees at the café with a staff PIN.

The code is fully built. To switch it **on**, you connect two free accounts —
**Supabase** (accounts + database) and **Stripe** (card payments) — and paste a
handful of keys into Vercel. No coding required. Takes about 20–30 minutes.

> Until this is done, opening `/app` shows a friendly "Almost ready" screen —
> nothing is broken, it's just waiting for its keys.

---

## What you'll end up with

- Customers: sign up → **Buy a bundle** (pay for 5) → balance shows **7 coffees** →
  tap **Use a coffee** at the counter, staff enter the PIN, balance ticks down.
- You: every purchase and redemption is logged; money lands in your Stripe account.

---

## Step 1 — Supabase (accounts + balances)

1. Go to **supabase.com**, sign up (free), and **New project**. Pick a name
   (e.g. `coffee-kingdom`) and a strong database password. Choose the **Sydney**
   region.
2. When it's ready, open **SQL Editor → New query**. Open the file
   [`supabase/schema.sql`](supabase/schema.sql) from this repo, copy **all** of it,
   paste, and click **Run**. This creates the tables and security rules.
3. Go to **Project Settings → API** and copy these three values:
   - **Project URL** → this is `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` *(keep this one secret)*
4. *(Optional, smoother sign-up)* **Authentication → Providers → Email** and turn
   **off** "Confirm email" so customers can start straight away. If you leave it on,
   they'll get a confirmation email before their first sign-in.

## Step 2 — Stripe (card payments)

1. Go to **stripe.com**, create an account, and complete the business details so you
   can accept live payments (you can test first in **Test mode**).
2. **Developers → API keys** → copy the **Secret key** → this is `STRIPE_SECRET_KEY`.
3. **Developers → Webhooks → Add endpoint**:
   - Endpoint URL: `https://YOUR-SITE/api/stripe-webhook`
     (use your real domain, e.g. the Vercel URL for this project)
   - Events to send: select **`checkout.session.completed`**
   - Create it, then copy the **Signing secret** → this is `STRIPE_WEBHOOK_SECRET`.

## Step 3 — Add the keys to Vercel

In the Vercel project for this site: **Settings → Environment Variables**. Add:

| Name | Value | Secret? |
| --- | --- | --- |
| `SUPABASE_URL` | from Step 1.3 | no |
| `SUPABASE_ANON_KEY` | from Step 1.3 | no |
| `SUPABASE_SERVICE_ROLE_KEY` | from Step 1.3 | **yes** |
| `STRIPE_SECRET_KEY` | from Step 2.2 | **yes** |
| `STRIPE_WEBHOOK_SECRET` | from Step 2.3 | **yes** |
| `STAFF_PIN` | a PIN your baristas will type (e.g. `4821`) | **yes** |
| `BUNDLE_PRICE_CENTS` | bundle price in cents (e.g. `2750` = A$27.50) | no |
| `PAY_COFFEES` | `5` | no |
| `BUNDLE_COFFEES` | `7` | no |
| `CURRENCY` | `aud` | no |

Then **redeploy** (Deployments → ⋯ → Redeploy) so the new variables take effect.

## Step 4 — Test it

1. Open `https://YOUR-SITE/app`.
2. Create an account, tap **Buy a bundle**. In Stripe **Test mode**, pay with card
   `4242 4242 4242 4242`, any future expiry, any CVC.
3. You'll return to the app and the balance should become **7** within a few seconds.
4. Tap **Use a coffee**, enter the `STAFF_PIN` → balance drops to **6**. 🎉
5. When you're happy, switch Stripe to **Live mode** and swap in the live keys.

---

## How your baristas use it

The customer taps **Use a coffee** on their own phone and hands it over; the barista
types the café PIN and the coffee comes off. Nothing to install at the counter.

## Changing the offer or price

It's all env vars — change `BUNDLE_PRICE_CENTS`, `PAY_COFFEES` or `BUNDLE_COFFEES`
in Vercel and redeploy. No code changes needed.

## Adding it to a phone's home screen

On the `/app` page: iPhone → Share → **Add to Home Screen**; Android → menu →
**Install app**. It then opens like a normal app with the crown icon.

## Prefer Square instead of Stripe?

You already use Square, so we can swap card payments over to Square later — it only
touches `api/create-checkout.js` and the webhook. Stripe is set up first because
it's the quickest secure path to go live. Just say the word.

---

## Files

```
app/                     the installable customer app (PWA)
  index.html  app.js  app.css
  manifest.webmanifest  sw.js  icon-*.png
api/                     serverless backend (Vercel functions)
  config.js              public settings for the app
  create-checkout.js     starts a Stripe payment
  stripe-webhook.js      credits coffees after payment
  redeem.js              takes one coffee off (staff PIN)
supabase/schema.sql      database tables + security rules
package.json             backend dependencies (installed by Vercel)
```
