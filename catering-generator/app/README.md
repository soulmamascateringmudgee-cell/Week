# Prep & Ordering — the web app

A Next.js app with two modes:

- **`/event`** — one date, one guest count, one menu. Order list by supplier
  category, packaging, a dated countdown, three risks, and what it still needs
  to know.
- **`/service`** — forecast covers in, par levels out, plus the delivery-day
  order, a prep list and shelf-life flags.

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # engine unit tests
npm run build    # production build
```

Node 22 or newer. `npm test` uses Node's built-in test runner with type
stripping, so there's no test framework to install.

## Deploying to Vercel

Zero config. Import the repo, set the **root directory** to
`catering-generator/app`, and deploy. Framework preset: Next.js.

The only environment variable is optional:

| Variable | Needed for | If missing |
|---|---|---|
| `ANTHROPIC_API_KEY` | The "paste your menu" shortcut on `/service` | The route returns 503 and the form hides the paste box. Everything else works. |

No database. Nothing is stored between requests — every plan is computed from
the form and returned.

## How it's laid out

```
src/lib/tables.ts        The yields, per-head figures, attach rates, buffers.
                         Server-only — this is the product.
src/lib/event-engine.ts  Guest count + menu → order list, countdown, risks.
src/lib/par-engine.ts    Covers + delivery cycle → par levels, order, prep.
src/lib/options.ts       Labels and keys for the forms. Deliberately separate
                         from tables.ts so the browser never sees the figures.
src/lib/*.test.ts        Unit tests, including a check that options.ts and
                         tables.ts haven't drifted apart.
src/app/api/plan/*       Thin route handlers. All maths happens server-side.
src/app/api/parse-menu   Optional Claude call that turns a pasted menu into
                         form rows. Does no arithmetic.
```

**The arithmetic is deterministic.** Every quantity comes from the engine, not
from a model — same inputs, same numbers, every time, with no API cost and
nothing to go wrong at service time. The one model call is a convenience that
fills in form fields, and the app is fully usable without it.

**Keep `tables.ts` server-side.** It's imported only by the engines, which are
imported only by route handlers. If a client component ever imports it, the
figures ship to the browser in the JS bundle. `options.ts` exists so that
never has to happen.

## Changing the numbers

Edit `src/lib/tables.ts` and run `npm test`. The tests pin the published worked
example (100 guests, standard dinner, three proteins → 17 kg brisket, 12.5 kg
chicken thigh, 11.5 kg fish), so if a change moves that, you'll know.

## What's not built yet

- Accounts and login (Supabase)
- Subscription billing (Stripe)
- Saved jobs, and scaling from a previous run of the same menu
- Supplier emails
- Food cost per head and margin
