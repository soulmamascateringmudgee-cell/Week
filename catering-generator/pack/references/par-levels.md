# Par Levels — the service engine

For ongoing trade: restaurants, cafes, kiosks, canteens, and vans on a regular
pitch. Event mode scales to a date. This scales to a **delivery cycle**.

The yield factors in `event-quantities.md` apply here unchanged — a brisket
still loses half its weight whether it's for a wedding or a Tuesday.

## The formula

```
Par (raw)  =  cover window  ×  sales mix %  ×  served portion  ×  yield multiplier  ×  (1 + safety %)

Order      =  Par  −  on hand
```

Five inputs. Get the cover window and the sales mix right and the rest is
arithmetic.

## 1. Cover window

The covers a delivery has to carry: everything from the moment stock lands to
the moment the **next** delivery lands, plus the lead time on that next order.

Deliveries Tuesday and Friday, trading Tue–Sun:

| Delivery | Carries | Cover window |
|---|---|---|
| Tuesday | Tue, Wed, Thu | Tue + Wed + Thu covers |
| Friday | Fri, Sat, Sun, Mon | Fri + Sat + Sun covers (Mon closed) |

The Friday order is nearly always the big one, and it is the one that gets
under-ordered because people order the same amount twice a week. Weekend covers
in most venues run 1.6–2.2× a weekday.

Add a **lead-time cushion** of half a day's covers if the supplier needs the
order in more than 24 hours ahead — a Thursday-morning order for a Friday
delivery cannot be corrected on Thursday night.

## 2. Sales mix

The share of covers that orders each item.

**Use POS data if it exists.** One week of item-level sales beats every default
in this file. Ask for it once, every time.

Without it, split evenly inside each category and flag it. Even-split is wrong
in a specific, predictable way: one or two items on any menu carry 30–40% of
their category, and an even split under-orders those and over-orders the tail.

### Course attach rates — restaurant

| Course | Share of covers |
|---|---|
| Mains | 0.95–1.0 |
| Entrées | 0.40–0.50 |
| Sides | 0.55–0.70 |
| Desserts | 0.30–0.40 |
| Bread / snacks | 0.35–0.50 |

### Cafe

| | Per customer |
|---|---|
| Coffee cups | 1.10–1.25 |
| Milk | 150 ml per coffee |
| Food attach rate (any food item) | 0.50–0.60 |
| — of that, counter/pastry vs kitchen | roughly 60 / 40 before 11am, reversing after |
| Takeaway share (drives packaging) | 0.35–0.55 |

Weekend cafe trade skews hot food and brunch; weekday skews coffee and counter.
Order pastry to the day, not the week — it is the single biggest waste line in
a cafe.

### Kiosk / van on a pitch

| | Per customer |
|---|---|
| Items per transaction | 1.2–1.5 |
| Sauce | 30 ml per item |
| Packaging | 1.1 per item (breakage and doubles) |

**Throughput bound:** ~60–80 items per hour per service window. If forecast
customers × items per transaction exceeds throughput × open hours, the
constraint is the window, not the stock. Say so — extra food will not sell
itself faster.

### Canteen

| | |
|---|---|
| Participation rate, normal day | 0.30–0.45 of roll |
| Participation rate, special / themed day | 0.55–0.75 of roll |
| Pre-order share where online ordering exists | 0.60–0.80 of participants |

Pre-orders are the gift here: they convert a forecast into a known number. Par
should cover pre-orders in full plus the counter estimate.

## 3. Served portion

Use the venue's own plate spec if it has one. If not:

| | Served portion |
|---|---|
| Main protein, restaurant plate | 160–200 g |
| Main protein, cafe plate | 120–150 g |
| Kiosk / handheld item | 110–140 g |
| Canteen serve | 90–120 g |
| Side, plated | 90–120 g |
| Salad / leaves per serve | 60–80 g |
| Chips per serve (raw) | 180–220 g |
| Sauce / dressing per serve | 30 ml |

## 4. Safety stock by shelf life

| Band | Shelf life | Safety | Examples |
|---|---|---|---|
| Short | 1–2 days | +5% | Leaves, soft herbs, fresh fish, dairy-heavy prep, cut fruit, pastry |
| Medium | 3–7 days | +10% | Raw proteins, hard veg, cheese, cured meat, eggs, milk |
| Long | 3+ weeks | *no par* | Dry goods, tinned, frozen, oils, packaging |

**Long-life items don't get a par — they get a minimum-stock line.** Order back
to a set number when they drop below it, in whatever pack size the supplier
sells. Running a weekly par on a 20 kg flour sack just makes noise.

Short-shelf-life items are where money is lost. If an item's shelf life is
shorter than its cover window, it **cannot** be ordered on that cycle — split
the delivery, change the item, or accept the waste. Flag it every time.

## 5. On hand

The order is always **par minus on hand**. Never hand someone a par table and
let them order the whole number — that is how a walk-in ends up with three
weeks of chicken.

Count on hand before every order. If a venue can't or won't count, the par
system will not work and it's worth saying so plainly.

## Daily prep to par

Par is a stock level. The prep list is what holds it.

Each trading morning, for each prepped component:
1. Count what's left.
2. Prep the difference between that and the day's par.
3. Prep in shelf-life order — longest-life items first, shortest last so they
   hit service freshest.

Rough prep times, one person:

| Task | Time |
|---|---|
| Portioning protein | 8–12 min per 10 kg |
| Salad wash and pick | 15 min per 5 kg |
| Veg prep (dice, roast trays) | 20 min per 10 kg |
| Sauces and dressings, batch | 20–30 min per batch |
| Slow cook items | 15 min hands-on, then oven time |
| Pastry / bake off | 10 min per tray + bake |

Total the prep hours and check them against the crew hours actually rostered.
A par plan that needs 14 hours of prep and has 6 hours of labour is not a plan.

## Storage check

Before finalising any order, check it fits:

| | Rough capacity |
|---|---|
| Standard upright fridge | 60–80 kg usable |
| Under-bench fridge | 25–35 kg usable |
| Walk-in, small | 250–400 kg usable |
| Chest freezer 300 L | 90–110 kg |

Usable is about 70% of nominal — airflow, trays, and things that won't stack.
Storage capacity, not money, is the most common hard limit on a big order.

## The three things that go wrong most

1. **The same order twice a week.** Weekend covers are nearly double weekday.
   Fix: build the cover window per delivery, never a flat weekly number.
2. **Sales mix guessed and never checked.** Fix: one week of POS item data,
   then rebuild the par table off real numbers.
3. **Ordering the par instead of par minus on hand.** Fix: count first. Make
   the count a line on the order sheet so it can't be skipped.
