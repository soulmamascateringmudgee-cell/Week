# Bomber Boxing — Mudgee

Marketing website for **Bomber Boxing**, Mudgee's community boxing gym.

**Train · Fit · Fight · Win**

## What's here

A fast, zero-dependency static site — no build step required.

```
index.html      # Single-page site (hero, about, classes, schedule, fight night, gallery, reels, contact)
styles.css      # Brand styling (black / red / white)
script.js       # Mobile nav, contact form (prefilled email) + reels player
assets/         # Logo and photos
assets/reels/   # Short-form videos for the Reels section (see its README)
```

## Sections

- **Hero** — brand statement and calls to action
- **About** — the four pillars (Train Hard, Get Fit, Fight Strong, Win Together)
- **Classes** — kids, boxing fitness, S&C, sparring, fighters, open gym
- **Schedule** — full weekly timetable
- **Fight Night** — Mudgee Madness event (Sat 12 Sep 2026, Parklands Mudgee)
- **Gallery** — photos from inside the gym
- **Reels** — short-form training and fight-night videos in a tap-to-play lightbox
- **Contact** — location, phone, email and an enquiry form

## Deploying to Vercel

This is a plain static site, so it deploys with **zero configuration**.

**Option A — Git (recommended)**
1. Push this repo to GitHub.
2. In Vercel, *Add New → Project* and import the repo.
3. Framework preset: **Other**. Leave build command and output directory empty.
4. Deploy.

**Option B — Vercel CLI**
```bash
npm i -g vercel
vercel        # preview
vercel --prod # production
```

## Editing content

- **Schedule** — edit the `<table class="schedule-table">` in `index.html`.
- **Contact details** — search `index.html` for the phone/email/address.
- **Fight night** — update the `#event` section and swap the poster in `assets/`.
- **Photos** — drop new images in `assets/` and update the `<img>` `src` paths.
- **Reels** — drop `.mp4` clips in `assets/reels/` and add them to the `REELS` list in `script.js` (see `assets/reels/README.md`).

## Contact

Unit 7, 22–26 Sydney Road, Mudgee (behind Mudgee Camping & 4WD)
0411 042 757 · bomberboxing@outlook.com
