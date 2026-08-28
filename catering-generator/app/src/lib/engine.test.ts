import assert from "node:assert/strict";
import { test } from "node:test";

import { planEvent } from "./event-engine.ts";
import { planService } from "./par-engine.ts";
import type { EventInput, ServiceInput, Weekday } from "./types.ts";

const baseEvent: EventInput = {
  guests: 100,
  eventDate: "2026-03-14",
  today: "2026-02-14",
  style: "shared",
  menuWeight: "standard",
  proteins: ["brisket", "chickenThigh", "fishFillet"],
  sidesCount: 3,
  starch: "potato",
  bread: true,
  dessert: "shared",
  grazing: "none",
  canapes: "none",
  drinksService: false,
  hotOrOutdoors: false,
  dietaries: [],
};

function qty(plan: ReturnType<typeof planEvent>, item: string): number {
  const line = plan.orders.find((o) => o.item === item);
  assert.ok(line, `no order line for "${item}"`);
  return line.qty;
}

// ------------------------------------------------------------- EVENT MODE

test("reproduces the published worked example", () => {
  // 100 guests, standard dinner, three proteins → 80 g served each.
  const plan = planEvent(baseEvent);
  assert.equal(plan.servedProteinPerPerson, 240);
  assert.equal(plan.servedPerProtein, 80);
  assert.equal(plan.effectiveGuests, 102);
  assert.equal(plan.bufferPct, 0.05);

  assert.equal(qty(plan, "Beef brisket, slow cooked"), 17);
  assert.equal(qty(plan, "Chicken thigh, boneless"), 12.5);
  assert.equal(qty(plan, "Fish fillet (barramundi, salmon)"), 11.5);
});

test("buffer bands switch at 40 and 80 guests", () => {
  const at = (guests: number) => planEvent({ ...baseEvent, guests }).bufferPct;
  assert.equal(at(39), 0.1);
  assert.equal(at(40), 0.07);
  assert.equal(at(80), 0.07);
  assert.equal(at(81), 0.05);
});

test("two crew meals are always carried", () => {
  const plan = planEvent({ ...baseEvent, guests: 20 });
  assert.equal(plan.effectiveGuests, 22);
});

test("raw weight uses the yield factor, not the served weight", () => {
  // One protein, so the whole 240 g served band lands on it.
  const plan = planEvent({ ...baseEvent, proteins: ["brisket"], guests: 100 });
  // 240 g served × 2.00 yield = 480 g raw × 102 × 1.05 = 51.408 kg
  assert.equal(qty(plan, "Beef brisket, slow cooked"), 51.5);
});

test("legumes scale down rather than up", () => {
  const plan = planEvent({ ...baseEvent, proteins: ["legumes"] });
  // Dried legumes more than double in weight, so raw < served.
  assert.ok(qty(plan, "Legumes, dried") < 240 * 0.102);
});

test("hot or outdoor service raises the water figure", () => {
  const mild = planEvent(baseEvent);
  const hot = planEvent({ ...baseEvent, hotOrOutdoors: true });
  assert.ok(qty(hot, "Water") > qty(mild, "Water"));
});

test("drinks service doubles the ice", () => {
  const chilling = planEvent(baseEvent);
  const service = planEvent({ ...baseEvent, drinksService: true });
  assert.equal(qty(service, "Ice"), qty(chilling, "Ice") * 2);
});

test("countdown carries real dates and flags what is already past", () => {
  const plan = planEvent({ ...baseEvent, today: "2026-03-11" });
  const orderDay = plan.countdown.find((s) => s.daysOut === 7);
  assert.ok(orderDay);
  assert.equal(orderDay.date, "Sat 7 Mar 2026");
  assert.equal(orderDay.overdue, true);
  assert.ok(plan.warnings.some((w) => w.includes("Order day")));
  assert.ok(plan.risks.some((r) => r.risk.includes("T-7")));
});

test("an event date in the past is called out", () => {
  const plan = planEvent({ ...baseEvent, today: "2026-03-20" });
  assert.ok(plan.warnings.some((w) => w.includes("in the past")));
});

test("dietaries get their own note and a risk", () => {
  const plan = planEvent({
    ...baseEvent,
    dietaries: [{ label: "Gluten free", count: 2 }],
  });
  assert.ok(plan.dietaryNotes.some((n) => n.includes("Gluten free × 2")));
  assert.ok(plan.risks.some((r) => r.risk.includes("dietary")));
});

test("van throughput is reported as a constraint, not more food", () => {
  const plan = planEvent({
    ...baseEvent,
    guests: 300,
    style: "van",
    vanItem: "burgers",
    serviceWindowHours: 2,
  });
  // 300 guests × 1.2 burgers ≈ 360+ items; two hours does about 140.
  assert.ok(plan.risks.some((r) => r.risk.startsWith("Throughput")));
});

test("rejects input that would produce a nonsense order", () => {
  assert.throws(() => planEvent({ ...baseEvent, guests: 0 }), /at least 1/);
  assert.throws(
    () => planEvent({ ...baseEvent, proteins: [] }),
    /Add a dish from your recipes/,
  );
  assert.throws(() => planEvent({ ...baseEvent, eventDate: "14/03/2026" }), /yyyy-mm-dd/);
  assert.throws(() => planEvent({ ...baseEvent, eventDate: "2026-02-31" }), /Not a real date/);
});

// ----------------------------------------------------------- SERVICE MODE

const covers: Record<Weekday, number> = {
  Mon: 0,
  Tue: 90,
  Wed: 90,
  Thu: 100,
  Fri: 140,
  Sat: 160,
  Sun: 120,
};

const baseService: ServiceInput = {
  venueType: "restaurant",
  covers,
  deliveryDays: ["Tue", "Fri"],
  leadTimeHours: 12,
  items: [
    {
      name: "Braised beef",
      category: "main",
      proteinKey: "brisket",
      portionG: 180,
      shelfLife: "medium",
      onHandKg: 4,
    },
    {
      name: "Market fish",
      category: "main",
      proteinKey: "fishFillet",
      portionG: 180,
      shelfLife: "short",
      onHandKg: 0,
    },
    { name: "Garden salad", category: "side", portionG: 70, shelfLife: "short", onHandKg: 0 },
  ],
};

test("cover window follows the delivery cycle, not the calendar week", () => {
  const plan = planService(baseService);
  const [tue, fri] = plan.deliveries;

  assert.deepEqual(tue.carries, ["Tue", "Wed", "Thu"]);
  assert.equal(tue.coverWindow, 280);

  // Friday carries the weekend plus the closed Monday — nearly 60% more.
  assert.deepEqual(fri.carries, ["Fri", "Sat", "Sun", "Mon"]);
  assert.equal(fri.coverWindow, 420);
});

test("a single delivery day carries the whole week", () => {
  const plan = planService({ ...baseService, deliveryDays: ["Tue"] });
  assert.equal(plan.deliveries[0].carries.length, 7);
  assert.equal(plan.deliveries[0].coverWindow, 700);
  assert.ok(plan.risks.some((r) => r.risk.includes("One delivery a week")));
});

test("par applies mix, portion, yield and safety in that order", () => {
  const plan = planService(baseService);
  const beef = plan.deliveries[0].lines.find((l) => l.item === "Braised beef");
  assert.ok(beef);
  // 280 covers × (0.98 attach ÷ 2 mains) × 180 g × 2.0 yield × 1.10 safety
  assert.equal(beef.mixIsAssumed, true);
  assert.equal(beef.yieldMultiplier, 2);
  assert.equal(beef.safetyPct, 0.1);
  assert.equal(beef.parKg, 54.5);
});

test("the order is par minus on hand, and only for the first count", () => {
  const plan = planService(baseService);
  const first = plan.deliveries[0].lines.find((l) => l.item === "Braised beef")!;
  const second = plan.deliveries[1].lines.find((l) => l.item === "Braised beef")!;

  assert.equal(first.onHandKg, 4);
  assert.equal(first.orderKg, first.parKg - 4);
  // The stock count was taken once — the next cycle orders to full par.
  assert.equal(second.onHandKg, 0);
  assert.equal(second.orderKg, second.parKg);
});

test("a supplied sales mix overrides the default and clears the assumption", () => {
  const plan = planService({
    ...baseService,
    items: baseService.items.map((i) =>
      i.name === "Braised beef" ? { ...i, mixPct: 0.6 } : i,
    ),
  });
  const beef = plan.deliveries[0].lines.find((l) => l.item === "Braised beef")!;
  assert.equal(beef.mixIsAssumed, false);
  assert.equal(beef.mixPct, 0.6);
});

test("items that cannot survive the cycle are flagged", () => {
  const plan = planService(baseService);
  // Friday carries 4 days; short shelf life is 2.
  const fish = plan.deliveries[1].lines.find((l) => l.item === "Market fish")!;
  assert.match(fish.flag ?? "", /Shelf life is 2 days/);
  assert.ok(plan.risks.some((r) => r.risk.includes("Market fish")));
});

test("long-life items get a minimum-stock line instead of a par", () => {
  const plan = planService({
    ...baseService,
    items: [
      ...baseService.items,
      { name: "Flour", category: "side", portionG: 40, shelfLife: "long", onHandKg: 0 },
    ],
  });
  const flour = plan.deliveries[0].lines.find((l) => l.item === "Flour")!;
  assert.match(flour.flag ?? "", /minimum-stock line/);
});

test("a long lead time adds a cushion to the cover window", () => {
  const tight = planService(baseService);
  const slow = planService({ ...baseService, leadTimeHours: 48 });
  assert.ok(slow.deliveries[0].coverWindow > tight.deliveries[0].coverWindow);
});

test("prep hours are checked against what is actually rostered", () => {
  const plan = planService({ ...baseService, prepHoursAvailable: 2 });
  assert.ok(plan.prepTotalMinutes > 120);
  assert.ok(plan.risks.some((r) => r.risk.includes("Prep needs")));
});

test("storage is checked against the biggest single delivery", () => {
  const plan = planService({ ...baseService, fridgeCapacityKg: 30 });
  assert.ok(plan.storageKg > 30);
  assert.ok(plan.risks.some((r) => r.risk.includes("cold storage")));
});

test("guessed sales mix is always surfaced as the biggest error source", () => {
  const plan = planService(baseService);
  assert.ok(plan.risks.some((r) => r.risk.includes("Sales mix is a guess")));
  assert.ok(plan.missing.some((m) => m.includes("POS")));
});

test("rejects an operation the engine cannot scale", () => {
  assert.throws(
    () => planService({ ...baseService, deliveryDays: [] }),
    /at least one delivery day/,
  );
  assert.throws(
    () => planService({ ...baseService, deliveryDays: ["Tue", "Tue"] }),
    /only be listed once/,
  );
  assert.throws(() => planService({ ...baseService, items: [] }), /at least one menu item/);
  assert.throws(
    () =>
      planService({
        ...baseService,
        covers: { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 },
      }),
    /covers are zero/,
  );
});
