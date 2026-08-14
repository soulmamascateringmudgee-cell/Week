---
name: prep-and-ordering
description: Turns a food service operation into an orderable list. Two modes. EVENT mode scales raw ingredient quantities from a guest count using served-weight and yield-factor maths, splits the order by supplier, adds the packaging kit, and produces a dated countdown to the event — for caterers, event companies, food vans and private chefs. SERVICE mode builds weekly par levels, a daily prep list and a delivery-day order from forecast covers — for restaurants, cafes, kiosks and canteens. Trigger on "what do I need to order", "build my order list", "how much chicken for X people", "prep list", "scale this menu", "set my par levels", "how much should I be prepping", "I've got a function on [date]", or any quantity question ("how much brisket for 60?").
---

# Prep & Ordering

Turns a menu and a number of people into quantities you can actually order.

## Step 0 — Pick the mode

**EVENT mode** — a one-off job with a date and a guest count. Caterers, event
companies, food vans on a booking, private chefs, functions inside a venue.
Anchor is **T-7**, seven days before the event.

**SERVICE mode** — ongoing trade with repeating covers. Restaurants, cafes,
kiosks, canteens, and a van doing a regular pitch. Anchor is the **delivery
cycle**, not a date.

If the request has a single date and a guest count, it's EVENT. If it has a
trading week and forecast covers, it's SERVICE. If genuinely unclear, ask —
one question, then proceed.

---

# EVENT MODE

## Step 1 — Collect the job

Ask for anything missing. Do NOT guess a guest count, service style, or event
date — those three change every number. Everything else can be flagged as an
assumption and carried forward.

Required:
- Guest count + whether it's estimate or confirmed
- Event date (and today's date, to compute the countdown)
- Service style: shared table · grazing/canapés · van/street food · plated · multi-day
- The menu — arrival, mains, sides, dessert
- Menu weight: light lunch · standard dinner · big feasting

Worth having, ask once and move on if unanswered:
- Dietaries, and whether a shared dish covers them
- Venue: kitchen, fridge/freezer space, power, gas, bump-in time
- What's already in stock (pantry, packaging, freezer)
- Hire and crew status

If the user only asks a quantity question ("how much brisket for 60?"), skip
straight to Step 2 and answer just that.

## Step 2 — Compute quantities

Read `references/event-quantities.md` for the per-head figures and yield
factors. The method, every time:

1. Pick total **served** protein per person from the menu weight band.
2. Divide by the number of proteins on the menu.
3. Multiply each by its **yield factor** to get raw weight to order.
4. Multiply by guest count.
5. Add buffer: +10% under 40 guests · +7% for 40–80 · +5% for 80+. Always add 2 crew meals.

Show the maths in one line per protein so it can be sanity-checked. Never
present a raw weight without showing the served weight and yield it came from.

Sides, grazing, dessert, drinks and van items all have their own per-head
figures in the reference — use them rather than estimating.

## Step 3 — Build the output

Return these six blocks, in this order, in tables. No preamble, no padding.

1. **Order tables by supplier category** — Meat/Seafood · Produce · Dairy · Dry goods · Packaging · Drinks. Columns: Item, Qty, Unit, For which dish.
2. **Dietary items, listed separately**, with the instruction to pack and label them apart from main stock.
3. **Packaging and disposables** for this service style, from `references/countdown-and-kit.md`. Always include a chafing fuel count, ice, gas and gloves — these are the items that get forgotten because they aren't food.
4. **Countdown from today to the event**, with real dates. If today is already past T-7, say so at the top, in bold, before anything else.
5. **Three risks specific to this job** — venue, timing, throughput, cold chain or dietary — each with its fix.
6. **Missing information** — anything unanswered that would change the order, as direct questions.

---

# SERVICE MODE

## Step 1 — Collect the operation

Required:
- Venue type: restaurant · cafe · kiosk · canteen
- Forecast covers (or customers) per trading day, and which days you trade
- The menu, with the items that actually move
- Delivery days — which days stock arrives

Worth having:
- Sales mix — what share of covers orders each item. Real POS data beats every
  assumption in this skill; ask for it once.
- What's on hand right now
- Storage limits: fridge, freezer, dry
- Prep crew hours available

If sales mix is unknown, split evenly within each menu category, and **say
plainly that this is the biggest source of error in the whole plan** and that
one week of POS data would fix it.

## Step 2 — Compute par levels

Read `references/par-levels.md`. The method, every time:

1. Work out the **cover window** — total forecast covers from this delivery to
   the next one, plus the lead time on the following order.
2. For each menu item: cover window × sales mix % = portions needed.
3. Portions × served portion weight = served weight.
4. Served weight × yield factor = raw weight. (Same yield table as event mode.)
5. Add safety stock by shelf-life band: short +5% · medium +10% · long: order to a minimum-stock line instead of a par.
6. Subtract what's on hand. **That's the order.**

Show the cover window and the sales mix used on every line. If either is a
guess, mark the line as an assumption.

## Step 3 — Build the output

1. **Par level table** — Item, Par (raw), Unit, Shelf life, Covers it carries.
2. **Order for the next delivery** — par minus on-hand, grouped by supplier category.
3. **Daily prep list** — what gets prepped each trading morning to hold par, in prep order, with a rough time per task.
4. **Shelf-life and waste flags** — anything ordered that won't survive to the next delivery, and what to do about it.
5. **Three risks** — storage capacity, prep hours, throughput, single-supplier dependency or a menu item that can't hold.
6. **Missing information** — as direct questions. Sales mix goes here every time it was guessed.

---

## Step 4 — Offer, don't do

After delivering, offer these as one short line each. Only run them if asked.

- Draft the supplier emails (one per supplier, with a delivery date and window)
- Estimate food cost per head or per cover, and gross margin against the price charged
- Save this as a job record to scale from next time

## Rules

- **Raw weight, not served weight.** Yield factors are the whole point — 100 g of pulled brisket on a plate needs 200 g raw. Getting this wrong under-orders by half.
- **Real numbers beat the tables.** If the user has a record of what they actually used on a previous run of the same menu, or POS sales mix data, scale from that and say you're doing so.
- **Never scale a multi-day job by day.** Scale per service (Mon dinner, Tue morning tea, Tue lunch…), and order shared pantry items once across the stay. Check fridge capacity before finalising.
- **Throughput is a constraint, not a quantity.** One van or kiosk service window does ~60–80 items an hour. If the people can't be fed in the window, say so instead of just ordering more food.
- **Par levels are not order quantities.** The order is always par minus on-hand. Never hand someone a par table and let them order the whole number.
- Where a quantity is judgement rather than formula, say so and give a range.
- Metric by default — kg, g, ml, L. Convert on request; the yield factors and ratios are unit-independent.
- Every output ends with the line: *These quantities are a planning guide based
  on standard yields. Check them against your own service records before ordering.*
