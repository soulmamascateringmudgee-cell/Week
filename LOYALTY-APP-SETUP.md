# Coffee Kingdom Rewards — setup guide

This is the "buy 5 coffees, get 7" loyalty app. It's an installable web app (PWA)
that lives at **`/app`** on the Coffee Kingdom site. Customers create an account,
buy a bundle by card, and redeem coffees at the café with a staff PIN.

Payments run through **Square** (the same Square you already use). The code is fully
built — to switch it **on**, you connect **Supabase** (accounts + database) and your
**Square** account, then paste a handful of keys into Vercel. No coding required.

> Until this is done, opening `/app` shows a friendly "Almost ready" screen —
> nothing is broken, it's just waiting for its keys.

---

## What you'll end up with

- Customers: sign up → **Buy a bundle** (pay for 5) → balance shows **7 coffees** →
  tap **Use a coffee** at the counter, staff enter the PIN, balance ticks down.
- You: every purchase and redemption is logged; money lands in your Square account.
- A printable **QR poster** at `/app/card.html` — "Scan to check your coffee balance".

---

## Step 1 — Supabase (accounts + balances)

*(If we provisioned this for you already, skip to step 1.3 to grab the keys.)*

1. Go to **supabase.com**, sign up (free), **New project**. Name it e.g.
   `coffee-kingdom`, set a strong database password, choose the **Sydney** region.
2. Open **SQL Editor → New query**. Open [`supabase/schema.sql`](supabase/schema.sql),
   copy all of it, paste, and click **Run**. This builds the tables and security rules.
3. **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` *(keep secret)*
4. *(Optional, smoother sign-up)* **Authentication → Providers → Email** → turn **off**
   "Confirm email" so customers can start straight away.

## Step 2 — Square (card payments)

1. Go to **developer.squareup.com**, sign in with your Square account, and open the
   **Developer Dashboard → Applications**. Use your existing app or create one.
2. Start in the **Sandbox** to test, then switch to **Production** when ready. From
   the application's **Credentials** page copy:
   - **Access token** → `SQUARE_ACCESS_TOKEN` *(keep secret)*
   - Your **Location ID** (Square Dashboard → Locations, or the API "Locations"
     list) → `SQUARE_LOCATION_ID`
3. Set up a **webhook** so paid bundles credit automatically:
   **Webhooks → Subscriptions → Add endpoint**
   - URL: `https://YOUR-SITE/api/square-webhook`
   - Events: tick **`payment.updated`**
   - Save, then copy the **Signature key** → `SQUARE_WEBHOOK_SIGNATURE_KEY` *(secret)*

## Step 3 — Add the keys to Vercel

In the Vercel project for this site: **Settings → Environment Variables**. Add:

| Name | Value | Secret? |
| --- | --- | --- |
| `SUPABASE_URL` | from Step 1.3 | no |
| `SUPABASE_ANON_KEY` | from Step 1.3 | no |
| `SUPABASE_SERVICE_ROLE_KEY` | from Step 1.3 | **yes** |
| `SQUARE_ACCESS_TOKEN` | from Step 2.2 | **yes** |
| `SQUARE_LOCATION_ID` | from Step 2.2 | no |
| `SQUARE_ENVIRONMENT` | `sandbox` while testing, `production` when live | no |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | from Step 2.3 | **yes** |
| `SQUARE_WEBHOOK_URL` | the full webhook URL from Step 2.3 | no |
| `STAFF_PIN` | a PIN your baristas will type (e.g. `4821`) | **yes** |
| `BUNDLE_PRICE_CENTS` | bundle price in cents (e.g. `2750` = A$27.50) | no |
| `PAY_COFFEES` | `5` | no |
| `BUNDLE_COFFEES` | `7` | no |
| `CURRENCY` | `AUD` | no |

Then **redeploy** (Deployments → ⋯ → Redeploy) so the variables take effect.

## Step 4 — Test it

1. Open `https://YOUR-SITE/app`, create an account, tap **Buy a bundle**.
2. In Square **Sandbox**, pay with test card `4111 1111 1111 1111`, any future
   expiry, any CVV, postcode `2850`.
3. You return to the app; the balance becomes **7** within a few seconds
   (the webhook credits it).
4. Tap **Use a coffee**, enter the `STAFF_PIN` → balance drops to **6**. 🎉
5. When happy, set `SQUARE_ENVIRONMENT=production` and swap in your **production**
   Square access token + a production webhook signature key, then redeploy.

---

## The QR poster

Open **`https://YOUR-SITE/app/card.html`** — it shows a branded
"Scan to check your coffee balance" card with a QR that points at your app. Use the
**Print** button for the counter/coffee cart, or **Download PNG** to drop into a
flyer or social post. The QR automatically matches whatever domain the site is on.

## How your baristas use it

The customer taps **Use a coffee** on their own phone and hands it over; the barista
types the café PIN and the coffee comes off. Nothing to install at the counter.

## Changing the offer or price

All env vars — change `BUNDLE_PRICE_CENTS`, `PAY_COFFEES` or `BUNDLE_COFFEES` in
Vercel and redeploy. No code changes needed.

## Adding it to a phone's home screen

On `/app`: iPhone → Share → **Add to Home Screen**; Android → menu → **Install app**.

---

## Files

```
app/                     the installable customer app (PWA)
  index.html  app.js  app.css
  card.html              printable "scan to check balance" QR poster
  manifest.webmanifest  sw.js  icon-*.png  vendor/qrcode-generator.js
api/                     serverless backend (Vercel functions)
  config.js              public settings for the app
  create-checkout.js     starts a Square hosted checkout
  square-webhook.js      credits coffees after payment
  redeem.js              takes one coffee off (staff PIN)
supabase/schema.sql      database tables + security rules
package.json             backend dependency (installed by Vercel)
```
