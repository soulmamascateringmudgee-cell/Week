# Read Me Maybe: landing page and Stripe setup

A blind date with a book. One page, no build step, no monthly website fee. Link it
from your Instagram bio and it does the whole shop.

```
read-me-maybe/
  index.html    # the page
  styles.css    # brand styling (cream / library blue / brush script)
  script.js     # the vibe picker + Stripe buttons  ← the only file you'll edit
  README.md     # this guide
```

---

## The short version

1. In Stripe, make **three Payment Links**: $39.95 book only, $69.95 one-off box,
   $65.95/month subscription.
2. On each link, add a **dropdown custom field** for the reading vibe, and turn on
   **collect shipping address**.
3. Paste the three link URLs into the `CONFIG` block at the top of `script.js`.
4. Publish the page (Netlify or Vercel, free), put the URL in your Instagram bio.

You do **not** need a backend, a database, or a Shopify subscription. Stripe hosts the
checkout, sends the receipts, charges the subscriptions each month and handles refunds.

---

## Step 1. Set up Stripe

Sign up at [stripe.com](https://stripe.com) with your business details (ABN, bank
account for payouts). Do everything below in **Test mode** first. There's a toggle in
the top right of the dashboard. Test card number: `4242 4242 4242 4242`, any future
expiry, any CVC.

### Create the three products

Dashboard → **Product catalogue** → **Add product**.

**Product 1: the book on its own**

| Field | Value |
|---|---|
| Name | The Single Date |
| Description | One wrapped blind date book, a clue card and bookish stickers. No extra gifts. Posted Australia-wide. |
| Price | `39.95` AUD |
| Billing | **One-off** |

**Product 2: the one-off box**

| Field | Value |
|---|---|
| Name | The One Off Box Date |
| Description | One wrapped blind date book, two little gifts, a clue card and bookish stickers. Posted Australia-wide. |
| Price | `69.95` AUD |
| Billing | **One-off** |

**Product 3: the subscription**

| Field | Value |
|---|---|
| Name | The Monthly Box Date |
| Description | A new wrapped blind date book every month, three little gifts, a clue card and bookish stickers. Posted Australia-wide. |
| Price | `65.95` AUD |
| Billing | **Recurring**, monthly |

Prices include postage, so you don't need to add a shipping rate. (If you'd rather
charge postage separately later, you can add a shipping rate to the link instead.)

### Turn each product into a Payment Link

Dashboard → **Payment Links** → **New**. Pick the product, then before you finish,
open the options and set:

- **Collect shipping address** → on, restricted to **Australia**. (This is the bit
  people forget, and without it you get paid but have nowhere to post the book.)
- **Custom fields** → add two:

  1. **Dropdown**, label `Your reading vibe`, required.
     Options, using the same wording as the page:
     `Romance`, `Spice`, `Thriller & mystery`, `Fantasy`, `Surprise me`.
  2. **Text**, label `Anything you've already read or would rather avoid?`, optional.

- **Quantity adjustable** → off for the subscription (one book per month).
- **After payment** → show a confirmation message, something like:
  *"Yes! Your blind date is on its way. Keep an eye on your inbox, and no peeking."*

Save, then copy the link. It looks like `https://buy.stripe.com/xxxxxxxx`.

Do this three times, once per product, so you end up with three URLs.

### For the subscription, turn on the customer portal

Settings → **Billing** → **Customer portal** → enable it, allow customers to cancel.
That gives subscribers a self-serve "manage my subscription" link, so cancellations
aren't your job. Add that portal link to your subscription's confirmation message and
to your welcome email.

---

## Step 2. Connect the links to the page

Open `script.js` and paste your two URLs into the top block:

```js
stripe: {
  'book-only': 'https://buy.stripe.com/your_book_only_link',
  'one-off':   'https://buy.stripe.com/your_one_off_box_link',
  'monthly':   'https://buy.stripe.com/your_subscription_link',
},
```

That's the only edit needed to go live. Same file also holds the vibe list, your
Instagram URL and your email address. Change those to match your real handles.

**How the vibe gets to you:** when someone picks a vibe on the page, the button sends
it to Stripe as `client_reference_id` (e.g. `monthly-romance`), which shows up on the
payment in your Stripe dashboard. The dropdown *inside* Stripe checkout catches it a
second time, so it's also on the receipt and in your CSV exports. Belt and braces:
if someone lands on your Stripe link directly from a DM without touching the page,
the dropdown still forces them to choose.

---

## Step 3. Publish the page

Free, no card needed, either works:

**Netlify Drop** (easiest, 30 seconds)
Go to [app.netlify.com/drop](https://app.netlify.com/drop) and drag the
`read-me-maybe` folder onto the page. You get a URL immediately. Rename the site to
something like `readmemaybe.netlify.app` in site settings.

**Vercel** (if you want it connected to this repo)
Import the repo, framework preset **Other**, and set **Root Directory** to
`read-me-maybe`. Leave build command and output directory empty.

Later, if you buy `readmemaybe.com.au`, you can point it at either host for free.

Then: Instagram → Edit profile → Website → paste the URL.

---

## Running it day to day

**Where orders show up**
- One-offs: Dashboard → **Payments**. Click a payment to see the shipping address,
  the vibe dropdown answer and the client reference ID.
- Subscriptions: Dashboard → **Billing** → **Subscriptions**. Each month Stripe
  charges automatically and emails a receipt.

**One thing to watch on subscriptions:** the vibe is captured when they *sign up*, not
on every monthly renewal. Keep a simple spreadsheet (name, address, vibe, start date)
and update it when someone messages you to change their vibe. Ten minutes a month, and
it doubles as your packing list.

**Fees:** Stripe takes roughly 1.7% + 30c on Australian cards (check their pricing page
for current rates). On $39.95 that's about $0.98, on $69.95 about $1.49, on $65.95 about $1.42. Payouts land in your
bank a couple of days after each payment.

**GST:** if you're not registered for GST, don't switch on Stripe Tax. Your prices are
just your prices. If you register later, that's a conversation for your accountant, and
Stripe Tax can handle it from that point.

---

## Sanity-check what you already built

If you started setting this up last night, run through this:

- [ ] Three separate products: two **one-off**, one **recurring monthly**. (Easy trap:
      making the monthly one-off too, so the "subscription" only ever charges once.)
- [ ] Currency is **AUD**, not USD.
- [ ] **Shipping address collection is on** for both links.
- [ ] The vibe custom field is **required**, and its options match the page.
- [ ] You've done one full **test-mode** purchase of each with `4242 4242 4242 4242`
      and seen both land in the dashboard.
- [ ] Business details and bank account are verified, so payouts actually pay out.
- [ ] You've flipped **out of test mode** and re-copied the links. Test-mode links
      don't take real money. This is the number one launch-day mistake.

---

## Changing the page later

Everything is plain HTML. Open `index.html` in any text editor and type over the words.

| What | Where |
|---|---|
| Prices | `index.html`, search for `$39.95`, `$69.95` and `$65.95` (change them in Stripe too) |
| Vibe options | `script.js`, the `vibes` list |
| FAQ answers | `index.html`, the `<details>` blocks near the bottom |
| Instagram / email | `script.js`, bottom of the `CONFIG` block |
| Colours and fonts | `styles.css`, the `:root` block at the very top |

Type is **Cormorant Garamond** for headings and **Inter** for body text, both free
from Google Fonts.

The wordmark and hearts aren't a font. They're your own hand lettering, cut out of
the brand card and saved as transparent PNGs in `assets/`:

| File | Used for |
|---|---|
| `wordmark.png` | the hero lockup, the dark strip (flipped to white in CSS) and the footer |
| `heart-large.png`, `heart-small.png` | the two hearts, positioned in `styles.css` |

To move a heart, edit `.heart-big` / `.heart-small` in `styles.css`. The `top`,
`left` and `bottom` percentages are measured against the wordmark, so it stays put
at every screen size.

---

## Ideas for when it's running

- Add a third one-off tier (a $45 "just the book" option). Same process, one more
  product and Payment Link, then copy a plan card in `index.html`.
- Gift subscriptions: a 3-month prepaid product priced in one go, so it doesn't renew.
- Collect emails with a Stripe post-purchase link to your mailing list, so you can send
  "what everyone read this month" round-ups.
