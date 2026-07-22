# Country Smart AI

A single-page landing site to send to business-owner friends. They fill in a
short form about their business and where their time goes, and it comes back to
you as a tidy, pre-filled email so you can send them a simple plan for putting
AI to work.

**Practical AI systems for rural women running everything.**
Save time · Grow income · Lighten the load.

## What's here

A fast, zero-dependency static site — no build step, no accounts, no backend.

```
index.html   # The whole page (hero, how it works, why, the form)
styles.css   # Brand styling (olive green / terracotta / sage / cream)
script.js    # Builds a pre-filled email from the form answers
assets/      # The Country Smart AI logo (and banner)
```

## How the form works

When someone fills in the form and hits **Send it to me**, their email app
opens with every answer neatly laid out and addressed to you. They just press
send and it lands in your inbox — nothing is stored anywhere else, and no
third-party service is involved.

- **Change where responses go:** edit the one line at the top of `script.js`:
  ```js
  var TO_EMAIL = "jessmyn.toovey@hotmail.com";
  ```
  (also update the address shown in the footer of `index.html`).

### Want responses to arrive automatically instead?

The email approach needs the person to press "send" in their own mail app,
which is occasionally fiddly on phones. If you'd rather answers arrive on their
own (no send step), the page can be switched to a free form service like
[Web3Forms](https://web3forms.com) or [Netlify Forms](https://docs.netlify.com/manage/forms/setup/) —
just ask and it's a small change.

## Editing content

- **Wording** — all copy lives in `index.html`; edit the text directly.
- **Questions** — the form fields are in the `<form id="leadForm">` section.
  Add or remove a field in `index.html`, then add its `id` to the list in
  `script.js` so it's included in the email.
- **Colours** — tweak the brand variables at the top of `styles.css`.
- **Logo** — replace `assets/logo.png`.

## Publishing it

It's a plain static site, so it deploys anywhere with zero config. This repo is
already connected to Vercel, so each push builds a preview automatically. To go
live, promote the deployment to production in Vercel (or drag the folder into
Netlify). Then share the link with your friends.

## Contact

jessmyn.toovey@hotmail.com
