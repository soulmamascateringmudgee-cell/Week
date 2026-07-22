# Country Smart AI — Free AI Workshop (Mudgee)

Landing page for the free, hands-on AI workshop for rural women in business.
Built from the "Mudgee Workshop Page" Country Smart AI design as a fast,
zero-dependency static site — no build step.

**Lightening the load for rural women in business.**

## What's here

```
index.html    # The landing page (hero, event facts, callout, registration form, footer)
styles.css    # Brand styling (cream / terracotta / olive, Georgia + Segoe UI)
script.js     # Registration form handling
assets/       # Country Smart AI logo
```

## The registration form

By default the form opens a pre-filled email to `hello@countrysmartai.com.au`
containing all the answers — so it works anywhere with no backend.

To collect submissions silently instead (recommended for a live campaign):

1. Create a free form endpoint at [Formspree](https://formspree.io),
   [Getform](https://getform.io), or [Basin](https://usebasin.com).
2. Open `script.js` and paste the endpoint URL into `FORM_ENDPOINT`.

When `FORM_ENDPOINT` is set, submissions POST there in the background and the
"You're on the list" confirmation shows without opening an email client.

## Editing content

- **Event details** — the four cards (When / Format / Where / Seats) are in the
  `<section class="facts">` block in `index.html`.
- **Contact details** — search `index.html` for the footer (email, phone, site).
- **Form questions** — edit the fields in the `<form id="register-form">` block.

## Deploying to Vercel

A plain static site — deploys with **zero configuration**.

**Git**
1. Push to GitHub.
2. In Vercel, *Add New → Project* and import the repo.
3. Framework preset: **Other**. Root directory: `countrysmart-ai`.
   Leave build command and output directory empty.
4. Deploy.

**Vercel CLI**
```bash
cd countrysmart-ai
vercel        # preview
vercel --prod # production
```
