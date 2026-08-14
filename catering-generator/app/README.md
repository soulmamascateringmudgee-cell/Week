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

Environment variables — copy `.env.local.example` to `.env.local` for local dev.
The two Supabase values are also committed in `.env.production`, so a deploy
needs no dashboard fiddling:

| Variable | Needed for | If missing |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Logins and saved jobs | Sign-in fails |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Logins and saved jobs | Sign-in fails |
| `ANTHROPIC_API_KEY` | The "paste your menu" shortcut on `/service` | The route returns 503 and the form hides the paste box. Everything else works. |

The Supabase publishable key is designed to ship in the browser — it grants
nothing on its own, and row-level security is what protects the data. It is
safe in the example file, in `.env.production`, and in Vercel's plain
environment variables. `ANTHROPIC_API_KEY` is a real secret and is in none of
them: set it in Vercel's project settings if you want it.

**Set the redirect URL in Supabase** before the first real sign-in:
*Authentication → URL Configuration → Site URL* must be your deployed origin,
and *Redirect URLs* must include `https://<your-domain>/auth/confirm`. Without
it the emailed link bounces to localhost.

## How it's laid out

```
supabase/migrations/     The schema. Apply in order to a fresh project.
src/middleware.ts        Refreshes the session, gates every page except
                         /, /login, /auth/* and /no-access, then checks the
                         invite list. API routes answer for themselves with a
                         401/403 rather than redirecting.
src/lib/access.ts        is_invited() and is_admin(), both failing closed.
src/lib/supabase/        Browser and server clients.
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

## Accounts and saved jobs

Sign-in is a magic link — the operator types an email, gets a link, and
they're in. No passwords to reset, which matters when the buyer is a chef and
not a computer person.

Every page except the landing page and login is gated, so the app is worth
paying for: a buyer gets an account rather than a copy of the files.

**It is invite-only.** Anyone on the internet can ask Supabase for a magic
link, so an account by itself means nothing — the `allowed_emails` table is the
permission. Sign in with an address that isn't on it and you land on
`/no-access` with no data and no way to make any. Manage the list at `/admin`,
which only an admin row can reach.

The rule is enforced in three places, and the one that counts is the last:
middleware redirects (or returns a JSON 403 on `/api/*`), the invites route
checks before it writes, and the row-level security policies on `jobs` require
`is_invited()` on every read and write. Turn the app off entirely and an
uninvited account still reaches nothing.

To add an operator: `/admin` → their email → *Add to the list*. To cut one off:
*Remove*. Their saved jobs stay in the database, out of reach, in case they
come back.

Saved jobs store the **form** as typed, not the computed plan. Opening a job
recomputes the numbers, so a correction to the tables reaches old jobs too and
you can never print a stale order list. Each job also takes a
*what you actually used* note — the number to scale from next time, which
beats every table in here.

> Supabase's built-in email sending is rate-limited on the free tier (a handful
> an hour) and sometimes lands in junk. Fine for the first few operators; wire
> up a proper email sender before you have a queue of them.

## What's not built yet

- Subscription billing (Stripe) — invoice by hand until the volume justifies it
- Supplier emails
- Food cost per head and margin
