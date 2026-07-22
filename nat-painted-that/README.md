# Nat Painted That — banner enquiry page

A single-page, hand-painted-banner enquiry / landing page for **Nat Painted That**.
Built to be linked straight from the Facebook page so customers can send through
everything Nat needs: the name, age, theme, colours, size and the date they need it by.

## ⚙️ Before it goes live — set two things

Open `index.html`, scroll to the `<script>` near the bottom, and edit these two lines:

```js
var NAT_EMAIL    = "your-email@example.com";                 // where enquiries are emailed
var FACEBOOK_URL = "https://www.facebook.com/NatPaintedThat"; // the "Message me" buttons
```

- **NAT_EMAIL** — the email address the enquiry form should send to. When someone
  submits the form it opens their email app with every detail pre-filled, addressed to Nat.
- **FACEBOOK_URL** — Nat's Facebook page (or a Messenger link like `https://m.me/YourPage`).
  Powers the green *Message me on Facebook* buttons.

That's the only setup needed.

## What's on the page

- **Hero** — logo, tagline and a friendly intro
- **How it works** — three simple steps
- **Examples** — a gallery of real banners
- **Enquiry form** — name, email, phone, occasion, name(s), age, theme, colours,
  size, date needed, pickup/delivery and extra details
- **Two ways to reach Nat** — pre-filled email *or* Facebook Messenger

## Files

```
index.html        # the whole page (styles + script are inline — nothing else needed)
assets/           # logo + example banner photos
```

## Putting it online

It's a plain static page — no build step. Any of these work:

- Drop the `nat-painted-that` folder onto **Netlify Drop** (netlify.com/drop) and copy the link.
- Or deploy this repo to **Vercel** — the page is at `/nat-painted-that/`.
- Then paste that link into the Facebook page's **Website / Contact button**.

## Swapping the example photos

Replace the files in `assets/` (keep the same names), or add new ones and update the
`<img src="...">` and `<figcaption>` lines in the *"A few I've painted"* section.
