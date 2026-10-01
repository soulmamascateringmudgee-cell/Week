# Handover — Soul Mamas catering app

Paste this into a new chat to pick up where the last one stopped.

## Who and what

Jessmyn, Soul Mamas Catering, Mudgee NSW. She's turning her own catering
ordering app into a product she sells. **Two paying subscribers already.**
Everything she asks for splits two ways: does this help her run Saturday's
job, or does this help her sell the app to another caterer.

## Where the code is

- Repo `soulmamascateringmudgee-cell/Week`, app in `catering-generator/app`
- Work branch: `claude/catering-generator-commercialize-gu5jwg`
- Next.js 16 App Router, React 19, TypeScript strict
- **Imports carry explicit `.ts` / `.tsx` specifiers.** Match the existing files.
- Tests: `npm test` → `node --test --experimental-strip-types src/lib/*.test.ts`
- **The `@/` alias does NOT resolve under the plain node test runner.** So all
  real logic lives in `src/lib/*.ts` with relative imports, and is tested
  there. Pages and routes stay thin.
- No ESLint in the project. `npx tsc --noEmit` and `npm run build` are the gates.

## Services

- **Supabase** production project `nskvxsnvxrwveqgoypzi`. RLS on everything.
  Testing a policy by hand needs the email claim, not just the sub —
  `is_invited()` reads `auth.jwt() ->> 'email'`.
- **Vercel** project `prep-and-ordering` (`prj_ZFTZcgFfmXZKKnNh5OUxjrB2yqlJ`),
  team `team_xfBclB5WlNsPy3CQSyMtZIo3`. Production alias `week-rlll.vercel.app`.
  Squash-merge to `main` → production deploy.
- `ANTHROPIC_API_KEY` **is** set in Vercel for production, preview and
  development. It is deliberately not in `.env.production`, so AI features
  can't be exercised in a dev container — they work on preview deploys.
- **This container's proxy blocks `*.vercel.app` and `*.supabase.co` for
  curl.** Check anything deployed with Firecrawl instead.

## How she wants things built

These came out of real bugs, so they're worth keeping:

- **Never present an estimate or a guess as a measurement.** If it wasn't
  measured, say it wasn't.
- **Never silently omit.** A field that couldn't be filled says so on screen.
- **Prove a test bites.** Write the test, then break the thing it guards and
  confirm it fails. Several real bugs were only caught this way.
- **Verify against the real system**, not against what the code looks like it
  does. Contrast ratios get computed, not eyeballed. Policies get run.
- Comments explain *why*, at length, in plain words. Read any existing file
  before writing a new one — the register is distinctive and consistent.

## What's live in production

- **Her brand.** Two palettes, `soul-mamas` (charcoal/burgundy/ochre, dark)
  and `soul-mamas-light` (warm cream). Brand sheet hexes: Charcoal `#292725`,
  Warm Cream `#F4EBDD`, Soul Burgundy `#762F32`, Golden Ochre `#D6A13B`.
  Playfair Display + Montserrat. Chosen per account in `profiles.brand`, read
  server-side in `layout.tsx` so there's no flash. Subscribers keep the neutral
  look. `src/lib/palette.test.ts` asserts every palette answers every token the
  default defines, **on screen and in print** — without that a dark palette
  prints cream ink on white paper and the order sheet comes out blank.
- **The crew app.** `/crew` for her, `/crew/[code]` for staff (public, no
  login — `src/middleware.ts` lets those through). Crew pick their own 4-digit
  PIN the first time they open the link. scrypt with a per-row salt, 5 attempts
  then a 15-minute lock, opaque session tokens stored hashed for 60 days.
  Sign-in failures never say which half was wrong.
- **Her wordmark** in the top-left, drawn as SVG text in `BrandMark.tsx` so it
  stays sharp and takes its colour from the palette.
- **Migrated off her old app:** 39 crew, 11 shifts, 4 roster lines from the
  Cloudflare Pages site. Could not migrate the per-person yes/no answers (PIN
  gated) or the PINs (hashed) — both were stated plainly at the time.

## Open right now

**PR #67 — the brief reader.** Draft, mergeable, CI green, no review comments.
Paste a chat / client email / photographed run sheet and it reads it into a
job, a menu matched against her recipe book, and roster days. New files:
`src/lib/brief.ts` (+22 tests), `src/app/api/read-brief/route.ts`,
`src/app/brief/page.tsx`.

The design rules, because they're the point of the feature:
- Anything the brief didn't state comes back `null`, never a default, and
  shows as "the brief didn't say". Gaps list *above* the filled fields.
- A dish only goes on the job if it's already in her recipe book. The model's
  claimed match is checked against the book and dropped if absent.
- A dietary outside the form's five labels is never mapped to the nearest one.
  It comes back verbatim, is warned about, and is written into the note on
  on-site shifts — ordered before the description, because the note is capped
  at 500 chars and the prose is what should get cut.
- Australian dates, 24-hour times, and a time it can't be sure of is dropped.

**Not verified:** the model call itself, because there's no key in the
container. Preview to try it on:
`https://prep-and-ordering-ohzl1h1td.vercel.app/brief`
She was going to test it with a real brief and then say whether to merge.

## Hers to do

- Change the temporary password `copper-lemon-3184` (unconfirmed whether done).
- **Retire the old Cloudflare app and delete Supabase project
  `mszdprpwodfulopxgdrg`.** Verified by querying it: `staff_names`,
  `active_offers`, `calendar_jobs` and `calendar_roster` are readable **with
  no PIN** — 39 full names, the job calendar, who's rostered. The link she
  shared carried an `fbclid`, so it has been through Facebook.
- Crew still need to open their links and claim PINs.

## Offered, never answered

Point Supabase auth emails at her existing Resend account via custom SMTP.
Her password reset links are being dropped by Hotmail — the auth log shows
`mail.send` succeeding from `noreply@mail.app.supabase.io` with no error, so
it's silent delivery failure at the far end. This affects her subscribers too.

## Raised, not built

- Owner-side timesheet view (approve and lock hours)
- Calendar month view
- The wordmark on printed sheets
