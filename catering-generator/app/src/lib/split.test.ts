import assert from "node:assert/strict";
import { test } from "node:test";

import { checkedSplits, combineOrders } from "./combine.ts";
import { toSpoonMeasures } from "./spoons.ts";
import type { OrderLine } from "./types.ts";

function line(
  item: string,
  qty: number,
  unit: string,
  forDish: string,
  over: Partial<OrderLine> = {},
): OrderLine {
  return {
    item,
    qty,
    unit,
    category: "Dry goods",
    forDish,
    basis: "test",
    ...over,
  } as OrderLine;
}

// --- One line to buy, three amounts to weigh -------------------------------

test("an ingredient in three dishes keeps all three amounts", () => {
  const [row] = combineOrders([
    line("Smoked paprika", 20, "g", "Popcorn chicken"),
    line("Smoked paprika", 15, "g", "Chicken sliders"),
    line("Smoked paprika", 12, "g", "Rainbow slaw"),
  ]);

  assert.equal(row.qty, 47, "one amount to buy");
  assert.deepEqual(row.split, [
    { dish: "Popcorn chicken", qty: 20, unit: "g" },
    { dish: "Chicken sliders", qty: 15, unit: "g" },
    { dish: "Rainbow slaw", qty: 12, unit: "g" },
  ]);
});

test("one dish named twice is one entry, added", () => {
  // Cayenne in the marinade and cayenne in the dredge is one pot's worth. Two
  // entries under the same name reads like two dishes and gets weighed twice.
  const [row] = combineOrders([
    line("Cayenne", 6, "g", "Fried chicken"),
    line("Cayenne", 4, "g", "Fried chicken"),
  ]);
  assert.deepEqual(row.split, [{ dish: "Fried chicken", qty: 10, unit: "g" }]);
});

test("a single-dish line has no split to print", () => {
  const [row] = combineOrders([line("Cornflour", 400, "g", "Popcorn chicken")]);
  assert.equal(row.split, undefined);
});

// --- The bracket has to agree with the number in front of it ---------------

test("the parts come back in the total's own spoon size", () => {
  // asSpoons would give the smaller share teaspoons and the total tablespoons.
  // "4½ tbsp (chicken 3¼ tbsp, sliders 3 tsp)" leaves the cook checking
  // whether the bracket adds up, which is the sum the sheet exists to do.
  const combined = combineOrders([
    line("Smoked paprika", 30, "g", "Popcorn chicken"),
    line("Smoked paprika", 9, "g", "Chicken sliders"),
  ]);
  const [row] = checkedSplits(toSpoonMeasures(combined));

  assert.equal(row.unit, "tbsp");
  assert.ok(row.split, "the bracket survives the conversion");
  assert.ok(
    row.split.every((part) => part.unit === "tbsp"),
    `parts should all be tbsp: ${JSON.stringify(row.split)}`,
  );
  const parts = row.split.reduce((sum, part) => sum + part.qty, 0);
  assert.ok(
    Math.abs(parts - row.qty) <= Math.max(row.qty * 0.1, 1),
    `${parts} should add to about ${row.qty}`,
  );
});

test("a bracket in the wrong unit is dropped, and the total kept", () => {
  // What produce does: grams in, whole onions out. Three onions split into
  // "main 900 g, salad 400 g" is two units on one row and no help at all.
  const [row] = checkedSplits([
    line("Onion", 3, "onions", "Main, Salad", {
      split: [
        { dish: "Main", qty: 900, unit: "g" },
        { dish: "Salad", qty: 400, unit: "g" },
      ],
    }),
  ]);
  assert.equal(row.split, undefined);
  assert.equal(row.qty, 3, "the total is the half that has to be right");
});

test("a bracket whose parts don't add up is dropped", () => {
  const [row] = checkedSplits([
    line("Flour", 1000, "g", "A, B", {
      split: [
        { dish: "A", qty: 100, unit: "g" },
        { dish: "B", qty: 100, unit: "g" },
      ],
    }),
  ]);
  assert.equal(row.split, undefined);
});

test("rounding either way is not a mismatch", () => {
  // Each part was rounded on its own, so the sum sits a little off the total.
  const [row] = checkedSplits([
    line("Paprika", 47, "g", "A, B", {
      split: [
        { dish: "A", qty: 30, unit: "g" },
        { dish: "B", qty: 20, unit: "g" },
      ],
    }),
  ]);
  assert.ok(row.split, "50 against 47 is rounding, not an error");
});

test("a one-entry split is nothing worth bracketing", () => {
  const [row] = checkedSplits([
    line("Flour", 500, "g", "Main", {
      split: [{ dish: "Main", qty: 500, unit: "g" }],
    }),
  ]);
  assert.equal(row.split, undefined);
});
