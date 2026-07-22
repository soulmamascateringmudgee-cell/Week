# Coffee Kingdom — Mudgee

Marketing website for **Coffee Kingdom**, Mudgee's home of barista-made coffee.

**Great coffee for any occasion** — two cafés and a mobile coffee cart.

## What's here

A fast, zero-dependency static site — no build step required.

```
index.html      # Single-page site (hero, about, cafés, menu, mobile cart, contact)
styles.css      # Brand styling (espresso / cream / gold)
script.js       # Mobile nav + enquiry form (opens a prefilled email)
assets/         # Logos and the mobile-cart photo (ck-*)
```

## Sections

- **Hero** — brand statement and calls to action
- **About** — the Coffee Kingdom story
- **Our Cafés** — the two Mudgee locations with address, phone, email and opening hours
- **Menu** — a taste of the drinks + Southside kitchen
- **Mobile Cart** — book the coffee cart for events
- **Contact** — enquiry form plus direct details for each café

## The business

**Coffee Kingdom Café** (inside Mudgee Hospital)
30 Meares Street, Mudgee NSW 2850 · 0472 919 646 · coffeekingdomcafe@gmail.com
Mon–Thu 6:30am–4:30pm · Fri 6:30am–3pm · Weekends closed
Facebook: https://www.facebook.com/profile.php?id=100093502890348

**Coffee Kingdom at Southside** (Southside Village)
Shop 6, 13 Oporto Rd, Mudgee NSW 2850 · (02) 6372 0907 · southside.coffeekingdom@gmail.com
Mon–Fri 5am–5pm · Sat–Sun 5am–2pm
Facebook: https://www.facebook.com/profile.php?id=61588026593953

**Mobile Coffee Cart** — for weddings, parties, corporate days, markets and more.

## Editing content

- **Café details / hours** — edit the `.cafe-card` blocks in `index.html`.
- **Menu** — edit the `.menu__grid` lists in `index.html`. (Prices are intentionally
  left out for now — add them per item once confirmed.)
- **Enquiry email** — the form sends to `coffeekingdomcafe@gmail.com`; change it in `script.js`.
- **Photos / logos** — drop new images in `assets/` and update the `<img>` `src` paths.

## Deploying

This is a plain static site, so it deploys with **zero configuration** on Netlify,
Vercel, GitHub Pages or Cloudflare Pages.

**Netlify / Vercel (Git)**
1. Push this repo to GitHub.
2. Import the repo in your host of choice.
3. Framework preset: **Other / None**. Leave build command and output directory empty.
4. Deploy.

**GitHub Pages**
Settings → Pages → Deploy from branch → root of this branch.

## Contact

Mudgee, NSW · 0472 919 646 · coffeekingdomcafe@gmail.com
