import assert from "node:assert/strict";
import { test } from "node:test";

import { buildPrepPlan, dayForStep } from "./prep.ts";
import type { Recipe } from "./types.ts";

const EVENT = "2026-09-20";
const TODAY = "2026-09-14";

function dish(name: string, method: string): Recipe {
  return { name, serves: 10, ingredients: [], method } as Recipe;
}

function dayOf(plan: ReturnType<typeof buildPrepPlan>, dishName: string): number[] {
  return plan
    .filter((day) => day.tasks.some((task) => task.dish === dishName))
    .map((day) => day.daysOut)
    .sort((a, b) => a - b);
}

function stepsOn(
  plan: ReturnType<typeof buildPrepPlan>,
  daysOut: number,
  dishName: string,
): string[] {
  return (plan.find((d) => d.daysOut === daysOut)?.tasks ?? [])
    .filter((t) => t.dish === dishName)
    .flatMap((t) => (t.steps ?? []).map((s) => `${s.label ?? ""}|${s.text}`));
}

// --- The work, not just the reminder ----------------------------------------

test("a prep task carries the cooking, step by step", () => {
  // "Prep the pudding" is a reminder. At 6am a cook needs the steps.
  const plan = buildPrepPlan(
    [
      dish(
        "Sticky date pudding",
        "PREP: Chop the dates.\nCream the butter and sugar.\nMAKE AHEAD: better the next day.",
      ),
    ],
    [],
    EVENT,
    TODAY,
  );
  const steps = stepsOn(plan, 1, "Sticky date pudding");
  assert.equal(steps.length, 3);
  assert.ok(steps.some((s) => s.includes("Chop the dates")));
  assert.ok(steps.some((s) => s.startsWith("PREP|")));
});

// --- A dish is not one day --------------------------------------------------

test("a step labelled for another day moves to it", () => {
  // The lamb goes in overnight; "MORNING: uncover and crank the oven" is event
  // day work, and filing it under the night before is telling a cook to do it
  // at midnight.
  const plan = buildPrepPlan(
    [
      dish(
        "Slow cooked lamb",
        "PREP: rub with oil.\nHeat oven 220C, then 120C covered overnight, 12 hrs.\nMORNING: uncover, crank to 220C to crisp the top.",
      ),
    ],
    [],
    EVENT,
    TODAY,
  );
  assert.deepEqual(dayOf(plan, "Slow cooked lamb"), [0, 1]);
  assert.ok(
    stepsOn(plan, 0, "Slow cooked lamb").some((s) => s.startsWith("MORNING|")),
  );
  assert.ok(
    stepsOn(plan, 1, "Slow cooked lamb").some((s) => s.startsWith("PREP|")),
  );
});

test("the amounts stay with the dish's own day", () => {
  // Repeating the whole ingredient list under a step pulled onto another day
  // would read as the dish being made twice.
  const plan = buildPrepPlan(
    [
      dish(
        "Slow cooked lamb",
        "PREP: rub with oil.\nCover and cook overnight, 12 hrs.\nMORNING: crank the oven.",
      ),
    ],
    [
      {
        name: "Slow cooked lamb",
        scaleNote: "x1",
        ingredients: [{ item: "Lamb shoulder", qty: 4, unit: "kg" }],
      },
    ],
    EVENT,
    TODAY,
  );
  const onDay = (n: number) =>
    (plan.find((d) => d.daysOut === n)?.tasks ?? []).filter(
      (t) => t.dish === "Slow cooked lamb",
    );
  assert.equal(onDay(1)[0].ingredients.length, 1, "the dish's own day carries them");
  assert.equal(onDay(0)[0].ingredients.length, 0, "the pulled step does not");
});

// --- Not re-deciding the dish's day ------------------------------------------

test("a one-paragraph method is never re-dated by one cue in it", () => {
  // The whole method is a single "step". The dish rules already read every cue
  // in it and are ordered so the least forgiving timing wins; re-dating it
  // here from one phrase would quietly overrule that.
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
  assert.deepEqual(dayOf(plan, "Chicken shawarma"), [2], "one day, the safest one");
});

test("a step naming two days names none", () => {
  assert.equal(
    dayForStep({ label: null, text: "Make it the day before, assemble on the day." }),
    null,
  );
  assert.equal(dayForStep({ label: null, text: "Chop the parsley." }), null);
  assert.equal(dayForStep({ label: "MORNING", text: "crank the oven." }), 0);
  assert.equal(dayForStep({ label: "MAKE AHEAD", text: "better tomorrow." }), 1);
});

test("a label that only looks like a time of day is not one", () => {
  // "MORNING GLORY MUFFINS" is a dish, not a staging instruction.
  assert.equal(
    dayForStep({ label: "MORNING GLORY MUFFINS", text: "grate the carrot." }),
    null,
  );
});

test("a dish always keeps a line on its own day", () => {
  // Even when every step named another day, the day the timing rules chose is
  // where the dish's reason lives.
  const plan = buildPrepPlan(
    [dish("Pavlova", "MAKE AHEAD: bake it.\nTO SERVE: whip the cream and top it.")],
    [],
    EVENT,
    TODAY,
  );
  assert.ok(dayOf(plan, "Pavlova").includes(1), "its classified day is on the list");
});
