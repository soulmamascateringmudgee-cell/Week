# Prep & Ordering

Turning the catering generator into something sellable. Two products from one
set of numbers.

```
pack/     The sellable kit — hand it over, invoice it, done. Ready now.
app/      The web app — they log in, you never send files. v1 works; no
          accounts or billing yet.
```

Working name only. Rename freely — it appears in `pack/SKILL.md`,
`pack/SALES-SHEET.md` and `app/src/app/layout.tsx`.

---

## What's actually being sold

Not the AI. The numbers:

- Yield factors for 13 proteins — the multiplier from served weight to raw weight
- Per-head served figures across light lunch, standard dinner and big feasting
- Sides, grazing, canapés, van items, dessert, drinks and ice
- Buffer rules that scale with guest count, plus two crew meals every time
- Van and kiosk throughput limits
- Par-level maths built on delivery cycles, sales mix and shelf life
- The countdown and packaging checklists

Anyone can wire up an AI. Nobody else has this yield table.

---

## Product 1 — the pack

A Claude skill the buyer installs on their own account. They pay Anthropic for
Claude; they pay you for the pack.

| File | What it is |
|---|---|
| `pack/SKILL.md` | The skill itself — routes to event mode or service mode |
| `pack/references/event-quantities.md` | The event scaling engine |
| `pack/references/par-levels.md` | The weekly par-level engine |
| `pack/references/countdown-and-kit.md` | Countdown, weekly rhythm, packaging kit |
| `pack/SETUP.md` | Non-technical install and first-run guide |
| `pack/LICENCE.md` | Single-business licence, disclaimer, ACL carve-out |
| `pack/SALES-SHEET.md` | One-pager to send prospects |

**Before you send it to anyone:** fill in the bracketed fields in `LICENCE.md`
and `SALES-SHEET.md` — business name, ABN, email, phone, prices. Have a
solicitor read the licence before you sell at volume.

---

## Product 2 — the web app

Next.js, deployable to Vercel with no configuration. Two modes:

- **Event** — one date, one guest count, one menu → order list by supplier
  category, packaging, dated countdown, three risks, missing information.
- **Weekly service** — forecast covers and delivery days → par levels, the
  delivery-day order, a prep list and shelf-life flags. Restaurants, cafes,
  kiosks and canteens.

Setup and deployment: `app/README.md`.

**The arithmetic is code, not a model.** Same inputs, same numbers, every time,
with no API cost and nothing to fail at service time. There's one optional
Claude call that reads a pasted menu into the form; the app works fine without
it.

### What's not built yet

Accounts, billing, saved jobs. Those are what turn it from a working tool into
a subscription, and they're the next piece of work.

---

## One correction worth knowing about

The quick-reference table in the original skill didn't match the skill's own
formula at small guest counts — it under-stated by 10–19% at 10, 25 and 50
guests, because it was built without the two crew meals. At 100 guests it was
exactly right, which is why it never showed up.

| Guests | Brisket, was | Brisket, now |
|---|---|---|
| 10 | 1.8 kg | 2.0 kg |
| 25 | 4.2 kg | 5.0 kg |
| 50 | 8.5 kg | 9.0 kg |
| 100 | 17 kg | 17 kg |

The table in `pack/references/event-quantities.md` is now generated from the
same formula the engine uses, and a unit test pins the worked example so the
two can't drift again.

---

## Selling it

Both products, one business per licence.

1. Fill in the bracketed fields in `LICENCE.md` and `SALES-SHEET.md`.
2. Offer to run it live on a job the buyer has already done — they know what
   they actually used, so they can judge how close it got.
3. Sell the pack now; move buyers onto the app when accounts and billing land.
4. Invoice under your ABN, with GST if registered.

The disclaimer matters and is already in every output, the licence and the
setup guide: **quantities are a planning guide, not a guarantee.** Don't remove
it.
