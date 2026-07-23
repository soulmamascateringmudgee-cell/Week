# Restore Massage and Beauty

Marketing website for **Restore Massage and Beauty**.

**Relax · Refresh · Reconnect**

A fast, zero-dependency static site - no build step, deploys to Vercel with zero configuration.

## What's here

```
index.html      # Single-page site (hero, about, services, gallery, contact)
styles.css      # Brand styling (sage green / cream)
script.js       # Mobile nav + enquiry form (opens a prefilled email)
assets/         # Real logo and studio photos
```

## Deploying to Vercel

**Option A - Git (recommended)**
1. Push this repo to GitHub.
2. In Vercel, *Add New → Project* and import the repo.
3. Framework preset: **Other**. Leave build command and output directory empty.
4. Deploy, then add the custom domain `restorebeautyandmassage.com.au` in
   Vercel → Project → Settings → Domains, and point the domain's DNS at Vercel.

**Option B - Vercel CLI**
```bash
npm i -g vercel
vercel        # preview
vercel --prod # production
```

## Content still to confirm

Because the live site couldn't be read, the following are **placeholders** - search
`index.html` for `EDIT:` comments and drop in the real details:

- **Services & prices** - the `#services` menu (names, durations, prices shown as `$-`).
- **About / owner bio** - the `#about` copy.
- **Contact** - address + Google Maps link, phone (and `tel:` link), email, opening hours.
- **Booking link** - the "Book Now" / "Book Online" buttons currently point to the contact form.
- **Social links** - Instagram / Facebook URLs.
- **Email** - the enquiry form address is also set at the top of `script.js`.

## Editing content

- **Services** - edit the `.menu` block in `index.html`.
- **Photos** - replace files in `assets/` (keep the same names, or update the `<img src>`).
- **Colours** - the palette lives in `:root` at the top of `styles.css`.
