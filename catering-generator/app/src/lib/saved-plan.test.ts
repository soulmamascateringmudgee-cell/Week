import assert from "node:assert/strict";
import { test } from "node:test";

import { planEvent } from "./event-engine.ts";
import type { EventInput, IngredientPrice } from "./types.ts";

/**
 * Why the sheet is stored rather than rebuilt.
 *
 * Opening a saved job used to leave the order list blank until it was
 * generated again. Regenerating is not a neutral act: the plan is built from
 * today's prices, today's recipes and today's pantry count, so the list that
 * comes back can differ from the one the food was actually ordered against —
 * silently, after the shopping is done.
 *
 * These tests pin that difference down, so it stays obvious why the plan is
 * saved with the job instead of recomputed on open.
 */

const base = {
  guests: 20,
  eventDate: "2026-09-20",
  today: "2026-09-14",
  style: "shared",
  menuWeight: "standard",
  proteins: ["chickenThigh"],
  sidesCount: 0,
  starch: "potato",
  bread: false,
  dessert: "none",
  grazing: "none",
  canapes: "none",
  drinksService: false,
  hotOrOutdoors: false,
  dietaries: [],
} as unknown as EventInput;

test("the same form gives a different sheet once a price moves", () => {
  const cheap: IngredientPrice[] = [
    { item: "Chicken thigh, boneless", unit: "kg", price: 9 },
  ];
  const dear: IngredientPrice[] = [
    { item: "Chicken thigh, boneless", unit: "kg", price: 18 },
  ];

  const before = planEvent({ ...base, prices: cheap });
  const after = planEvent({ ...base, prices: dear });

  assert.ok(before.costing && after.costing);
  assert.notEqual(
    before.costing.perHead,
    after.costing.perHead,
    "a price change alone moves the cost per head",
  );
});

test("the same form gives a different sheet once the pantry is counted", () => {
  const before = planEvent(base);
  const after = planEvent({
    ...base,
    stock: [{ item: "Chicken thigh, boneless", qty: 5, unit: "kg" }],
  });

  const marked = (plan: ReturnType<typeof planEvent>) =>
    plan.orders.filter((line) => line.inStock).length;

  assert.equal(marked(before), 0);
  assert.ok(marked(after) > 0, "a pantry count changes what the sheet says to buy");
});

test("the same form gives a different sheet once a recipe is edited", () => {
  const withRecipe = (qty: number) => ({
    ...base,
    recipes: [
      {
        name: "Slaw",
        serves: 10,
        method: "Shred it.",
        ingredients: [
          { item: "Red cabbage", qty, unit: "g", category: "Produce" as const },
        ],
      },
    ],
  });

  const before = planEvent(withRecipe(500) as unknown as EventInput);
  const after = planEvent(withRecipe(900) as unknown as EventInput);

  const cabbage = (plan: ReturnType<typeof planEvent>) =>
    plan.orders.find((line) => line.item === "Red cabbage")?.qty;

  assert.ok(cabbage(before) !== undefined);
  assert.notEqual(
    cabbage(before),
    cabbage(after),
    "editing the recipe changes the order it produces",
  );
});

test("nothing about the plan depends on when it is asked for", () => {
  // The one thing that must NOT drift: given identical inputs, the sheet is
  // the same sheet. Storing it would be pointless otherwise, and the
  // "you've changed something" notice would fire on jobs nobody touched.
  const once = planEvent(base);
  const twice = planEvent(base);
  assert.deepEqual(twice, once);
});
