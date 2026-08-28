import assert from "node:assert/strict";
import { test } from "node:test";

import { buildPrepPlan } from "./prep.ts";
import type { Recipe } from "./types.ts";

const EVENT = "2026-08-17";
const TODAY = "2026-08-14";

const dish = (name: string, method: string): Recipe => ({
  name,
  serves: 10,
  ingredients: [],
  method,
});

function tasksOn(plan: ReturnType<typeof buildPrepPlan>, daysOut: number) {
  return plan.find((d) => d.daysOut === daysOut)?.tasks.map((t) => t.dish) ?? [];
}

test("an overnight cook lands on the day before", () => {
  const plan = buildPrepPlan(
[
      dish(
        "12 hour slow cooked lamb shoulder",
        "Drop to 120C, cover the tray tightly with foil and leave it 10-12 hrs overnight.",
      ),
    ],
[],
EVENT,
    TODAY,
  );
  assert.ok(tasksOn(plan, 1).includes("12 hour slow cooked lamb shoulder"));
});

test("a 24 to 48 hour marinade starts two days out", () => {
  const plan = buildPrepPlan(
[dish("Greek chicken", "Coat chicken, marinate 24 hrs (min 3).")],
[],
EVENT,
    TODAY,
  );
  assert.ok(tasksOn(plan, 2).includes("Greek chicken"));
});

test("anything best on the day stays on the day", () => {
  const plan = buildPrepPlan(
[
      dish(
        "Buttermilk scones with jam & cream",
        "BEST ON THE DAY. If you must bake ahead, freeze them the moment they cool.",
      ),
    ],
[],
EVENT,
    TODAY,
  );
  assert.ok(tasksOn(plan, 0).includes("Buttermilk scones with jam & cream"));
});

test("a make-ahead bake moves off the event day", () => {
  const plan = buildPrepPlan(
[dish("Chocolate brownie", "MAKE AHEAD: better on day two. Airtight.")],
[],
EVENT,
    TODAY,
  );
  assert.ok(tasksOn(plan, 1).includes("Chocolate brownie"));
  assert.ok(!tasksOn(plan, 0).includes("Chocolate brownie"));
});

test("the slowest rule wins when a method matches more than one", () => {
  // Mentions both a 24-48 hr marinade and being assembled on the day.
  const plan = buildPrepPlan(
[
      dish(
        "Chicken shawarma",
        "Marinate 24 hrs (min 3). Assemble the morning of, no earlier.",
      ),
    ],
[],
EVENT,
    TODAY,
  );
  assert.ok(tasksOn(plan, 2).includes("Chicken shawarma"));
  assert.ok(!tasksOn(plan, 0).includes("Chicken shawarma"));
});

test("a marinated ingredient is not mistaken for a marinade step", () => {
  const plan = buildPrepPlan(
[
      dish(
        "Grazing platter (GF vegan)",
        "Marinated veg and olives in loose piles, not neat rows.",
      ),
    ],
[],
EVENT,
    TODAY,
  );
  const marinades = plan
    .flatMap((d) => d.tasks)
    .filter((t) => /Marinate/.test(t.task));
  assert.deepEqual(marinades, []);
});

test("a dish assembled on the day beats its make-ahead component", () => {
  // The herb mayo is made the day before, but the roll is built on the morning.
  const plan = buildPrepPlan(
[
      dish(
        "Roast chicken, avocado, cos & herb mayo baguette",
        "HERB MAYO: make it the day before. Assemble the morning of, no earlier. Avocado browns.",
      ),
    ],
[],
EVENT,
    TODAY,
  );
  assert.ok(
    tasksOn(plan, 0).includes("Roast chicken, avocado, cos & herb mayo baguette"),
  );
  assert.ok(
    !tasksOn(plan, 1).includes("Roast chicken, avocado, cos & herb mayo baguette"),
  );
});

test("a long chill beats a last-minute garnish", () => {
  const plan = buildPrepPlan(
[
      dish(
        "Chocolate & coconut mousse (GF vegan)",
        "Chill at least 4 hrs, overnight is better. Top with raspberries just before serving.",
      ),
    ],
[],
EVENT,
    TODAY,
  );
  assert.ok(tasksOn(plan, 1).includes("Chocolate & coconut mousse (GF vegan)"));
  assert.ok(!tasksOn(plan, 0).includes("Chocolate & coconut mousse (GF vegan)"));
});

test("a prep task carries the dish's amounts for this job", () => {
  const plan = buildPrepPlan(
    [dish("Greek chicken", "marinate 24 hrs")],
    [
      {
        name: "Greek chicken",
        scaleNote: "written for 10 → ×2.00 for 20",
        ingredients: [
          { item: "Chicken thighs", qty: 5, unit: "kg" },
          { item: "Lemon", qty: 6, unit: "ea" },
        ],
      },
    ],
    EVENT,
    TODAY,
  );
  const task = plan.flatMap((d) => d.tasks).find((t) => t.dish === "Greek chicken");
  assert.deepEqual(task?.ingredients, [
    { item: "Chicken thighs", qty: 5, unit: "kg" },
    { item: "Lemon", qty: 6, unit: "ea" },
  ]);
});

test("dishes with nothing time-sensitive are left off", () => {
  const plan = buildPrepPlan(
[dish("Bread rolls", "Serve at room temperature.")],
[],
EVENT,
    TODAY,
  );
  assert.deepEqual(plan, []);
});

test("no dishes means no prep list, not an empty day", () => {
  assert.deepEqual(buildPrepPlan(
[],
[],
EVENT, TODAY), []);
});

test("days run oldest first and carry real dates", () => {
  const plan = buildPrepPlan(
[
      dish("Greek chicken", "marinate 24 hrs"),
      dish("Scones", "BEST ON THE DAY."),
    ],
[],
EVENT,
    TODAY,
  );
  assert.deepEqual(
    plan.map((d) => d.daysOut),
    [2, 0],
  );
  assert.equal(plan[0].date, "Sat 15 Aug 2026");
  assert.equal(plan[1].date, "Mon 17 Aug 2026");
});

test("a day that has already passed is marked overdue", () => {
  const plan = buildPrepPlan(
[dish("Greek chicken", "marinate 24 hrs")],
[],
EVENT,
    "2026-08-16", // T-1, so the T-2 marinade day has gone
  );
  assert.equal(plan[0].overdue, true);
});

test("the cold-chain reminder is added once there is any cooking", () => {
  const plan = buildPrepPlan(
[dish("Greek chicken", "marinate 24 hrs")],
[],
EVENT,
    TODAY,
  );
  const eventDay = plan.find((d) => d.daysOut === 0);
  assert.ok(eventDay);
  assert.equal(eventDay.tasks.length, 1);
  assert.match(eventDay.tasks[0].task, /Load the car cold/);
});
