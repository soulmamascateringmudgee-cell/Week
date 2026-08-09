# Drizzle & Crunch — Dessert Bar

Static single-page site for the Drizzle & Crunch dessert van (Mudgee, NSW), plus one
serverless function for the event enquiry form. No build step, no framework.

```
index.html          the whole page
styles.css          all styling
script.js           sticky nav, the drizzle/crunch builder, enquiry form
api/enquiry.js      Vercel serverless function — emails the enquiry form
images/             photos (JPEG) and the logo (SVG)
vercel.json         caching + security headers
```

---

## Before this goes live

Three things need a real value. Everything else is finished.

**1. `RESEND_API_KEY` and `ENQUIRY_TO` environment variables**

The enquiry form posts to `/api/enquiry`, which sends the email via
[Resend](https://resend.com). Set these in the Vercel project (Settings →
Environment Variables):

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | API key from resend.com |
| `ENQUIRY_TO` | `drizzleandcrunch@outlook.com.au` |
| `ENQUIRY_FROM` | optional — a verified sender. Defaults to Resend's shared sandbox address |

Until the key is set the endpoint returns 503 and the form falls back to showing
the phone number and email address, so no enquiry is silently swallowed. Once the
domain is connected, verify it in Resend and set `ENQUIRY_FROM` to something like
`Drizzle & Crunch <hello@drizzleandcrunch.com.au>` so replies don't land in spam.

**2. The domain**

Once it's connected in Vercel, update the hard-coded domain in three places:
`<link rel="canonical">` and the `og:image` in `index.html`, the `@id`/`image` in
the JSON-LD block, and the `Sitemap:` line in `robots.txt` + the `<loc>` in
`sitemap.xml`. Search for `drizzleandcrunch.com.au`.

**3. Wedding and event pricing**

Deliberately **not** published. The supplied pricing guide carries three `EDIT`
markers — base hire fee, staff hourly rate, travel rate — and states those need
the business's real cost numbers before quoting anyone. The Events section sells
what's included and drives to the enquiry form instead, with pricing sent on
request. Once the numbers are confirmed, a pricing table can be added, but that's
a decision for the owners, not a formatting job.

---

## The builder

The "build your own" calculator is the one genuinely interactive piece. Prices in
`script.js` (`BASES`, `DRIZZLES`, `CRUNCHES`, `FRUIT`) are the real window prices
transcribed from the van's menu boards. Update them there and the section, the
running total and the chip labels all follow.

Sundaes and stick waffles include 1 drizzle and 1 crunch. That's modelled as a
discount equal to the cheapest selected item in each group, capped at the standard
rate ($2 drizzle, $1 crunch). So a $3 pistachio-plus-kataifi crunch used as the
"included" one still costs $2 — which is how the printed menu prices it. Açaí bowls
include no toppings, and the badges change to say so.

Prices verified against nine hand-computed cases, including the kataifi edge case.

It's a planner, not a checkout — there's no payment integration and the copy says so.

---

## The logo

`images/logo.svg` was converted from the supplied PDF by reading the vector paths
out of the content stream, including the five clipped gradient fills that draw the
"& crunch" script. It's a true vector, so it stays sharp at any size.

- `logo.svg` — dark wordmark, for cream backgrounds
- `logo-cream.svg` — knockout, for the hero photo and chocolate footer
- `logo-full.svg` — with the original cream background panel

The brand palette is taken from that same file rather than eyeballed:

| | |
|---|---|
| `#F9DEC2` | cream — page background |
| `#DA3263` | raspberry — accents, buttons |
| `#A62B4E` | deep raspberry — hover states |
| `#242627` | near-black — the wordmark, body text |
| `#46322C` | chocolate — the menu band and footer |

---

## Local preview

```bash
python3 -m http.server 8099     # static pages only
vercel dev                      # includes /api/enquiry
```

`python3 -m http.server` can't run the serverless function, so submitting the form
locally will show the phone-number fallback. That's expected.

---

## Deploying

Asset paths are **relative**, so the site renders correctly both at a project
root and when served from a subdirectory. That means the repo-root `week` Vercel
project already gives a working preview at `/drizzle-and-crunch/` — handy for
showing a client — but the serverless function will not run there, because Vercel
only picks up an `api/` directory at the deployment root. On that preview the
enquiry form falls back to showing the phone number.

For the real thing, add a **separate Vercel project** pointed at this folder:

> Add New → Project → import the `Week` repo → **Root Directory: `drizzle-and-crunch`**
> → Framework Preset: *Other*

That gives `/api/enquiry` a working route, applies `vercel.json`, and redeploys on
every push. It's the same arrangement the `read-me-maybe` project already uses.

---

## Notes

- Photos are resized and compressed to ~3.6MB total across 17 images; everything
  below the fold is lazy-loaded.
- Fonts are Fraunces (display) and DM Sans (body), served from Google Fonts.
- The form has a honeypot field and server-side validation; the function caps
  field length and escapes all output before it goes into the email HTML.
- Tested at 390px and 1380px. No horizontal overflow, keyboard-navigable, visible
  focus rings, 44px+ touch targets.
