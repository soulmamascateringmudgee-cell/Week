import assert from "node:assert/strict";
import test from "node:test";

import {
  hasUnscalableAmounts,
  unscalableLines,
  unscalableWarning,
} from "./recipe-health.ts";
import type { Category, Recipe } from "./types.ts";

/**
 * The real recipe off Jessmyn's screen. Twenty-one lines, fifteen of them
 * perfectly good, six with the amount stuck in the name — which is what a bad
 * import actually looks like, and what shipped undetected.
 */
const PULLED_PORK = recipe("Easy slow cooker BBQ pulled pork", [
  ["pork butt/shoulder", 2, "kg"],
  ["large onion, sliced", 1, "ea"],
  ["garlic cloves, crushed", 4, "ea"],
  ["smoked paprika", 1, "tbsp"],
  ["sweet paprika", 2, "tsp"],
  ["garlic powder", 2, "tsp"],
  ["onion powder", 2, "tsp"],
  ["salt", 2, "tsp"],
  ["black pepper", 1, "tsp"],
  ["brown sugar", 2, "tbsp"],
  ["1½ cups tomato sauce", 1, "ea"],
  ["½ cup brown sugar", 1, "ea"],
  ["⅓ cup apple cider vinegar", 1, "ea"],
  ["¼ cup Worcestershire sauce", 1, "ea"],
  ["American mustard or Dijon", 2, "tbsp"],
  ["BBQ sauce", 2, "tbsp"],
  ["smoked paprika", 1, "tbsp"],
  ["garlic powder", 1, "tsp"],
  ["onion powder", 1, "tsp"],
  ["½ tsp black pepper", 1, "ea"],
  ["½ cup apple juice or water", 1, "ea"],
]);

test("a vulgar fraction is a number", () => {
  // The bug that shipped. A pattern anchored on an ASCII digit misses "½ cup"
  // outright, and misses "1½ cups" too because the ½ sits between the digit
  // and the unit — so the one shape most worth catching sailed through.
  assert.deepEqual(
    unscalableLines(
      recipe("Sauce", [
        ["1½ cups tomato sauce", 1, "ea"],
        ["⅓ cup apple cider vinegar", 1, "ea"],
        ["½ cup apple juice or water", 1, "ea"],
      ]),
    ),
    ["1½ cups tomato sauce", "⅓ cup apple cider vinegar", "½ cup apple juice or water"],
  );
});

test("the plain shapes still catch", () => {
  assert.deepEqual(
    unscalableLines(
      recipe("Rolls", [
        ["Bacon: 225g", 1, "ea"],
        ["Panko: 60g (~1 1/8 cup)", 1, "ea"],
        ["1 1/2 cups tomato sauce", 1, "ea"],
        ["250 ml cream", 1, "ea"],
      ]),
    ).length,
    4,
  );
});

test("a part-broken recipe is warned about, not waved through", () => {
  // The second bug. Six bad lines out of twenty-one is under any majority
  // threshold, and a majority rule therefore said nothing at all about the
  // recipe Jessmyn was looking at. Its fifteen good lines are exactly what
  // made the six bad ones look trustworthy.
  const broken = unscalableLines(PULLED_PORK);
  assert.equal(broken.length, 6);
  assert.ok(broken.length / PULLED_PORK.ingredients.length < 0.5, "under a majority");
  assert.notEqual(unscalableWarning(PULLED_PORK), "", "must still warn");
});

test("the warning names the lines to fix", () => {
  const warning = unscalableWarning(PULLED_PORK);
  assert.match(warning, /6 lines/);
  assert.match(warning, /1½ cups tomato sauce/);
  assert.match(warning, /and 3 more/);
  assert.match(warning, /Amount and Unit columns/);
});

test("a mostly-broken recipe still fails the whole sheet", () => {
  // The dish sheet prints dashes instead of numbers only when nothing on it
  // can be relied on. Six bad lines out of twenty-one leaves fifteen good
  // ones, and blanking those would throw away the part that works.
  assert.equal(hasUnscalableAmounts(PULLED_PORK), false);
  assert.equal(
    hasUnscalableAmounts(
      recipe("All broken", [
        ["1½ cups tomato sauce", 1, "ea"],
        ["½ cup brown sugar", 1, "ea"],
        ["⅓ cup vinegar", 1, "ea"],
        ["pork shoulder", 2, "kg"],
      ]),
    ),
    true,
  );
});

test("a real one-of-something is left alone", () => {
  // "1 ea slice cheese" per burger scales correctly to 67 slices. "1 ea small
  // head iceberg lettuce" is one head. Flagging these would cry wolf on the
  // lines that are right, which is how a warning stops being read.
  assert.deepEqual(
    unscalableLines(
      recipe("Burgers", [
        ["slice cheese", 1, "ea"],
        ["of cos lettuce", 1, "ea"],
        ["burger sauce", 1, "ea"],
        ["salt and pepper", 1, "ea"],
        ["milk bun", 1, "ea"],
      ]),
    ),
    [],
  );
});

test("a number that isn't an amount doesn't trip it", () => {
  // "1 large onion" is not one litre. "1/2 long cucumber" is not a unit at
  // all. The unit has to be a real one, on a word boundary.
  assert.deepEqual(
    unscalableLines(
      recipe("Salad", [
        ["large onion, sliced", 1, "ea"],
        ["cucumber (, or 1/2 long Telegraph cucumber)", 1, "ea"],
        ["iceberg lettuce (, chopped (5 to 6 big handfuls))", 1, "ea"],
      ]),
    ),
    [],
  );
});

test("a line with a real amount column is never flagged", () => {
  // The name may be a mess — "/ 125 ml lemon juice" — but if the Amount column
  // says 0.5 cup then the maths is sound and the name is cosmetic.
  assert.deepEqual(
    unscalableLines(
      recipe("Greek chicken", [
        ["/ 125 ml lemon juice", 0.5, "cup"],
        ["garlic cloves (, minced (~ 2 tbsp))", 6, "ea"],
      ]),
    ),
    [],
  );
});

test("a two-line recipe is too small to judge", () => {
  assert.equal(
    hasUnscalableAmounts(recipe("Snack", [["½ cup nuts", 1, "ea"]])),
    false,
  );
});

test("a clean recipe produces no warning at all", () => {
  const clean = recipe("Slaw", [
    ["green cabbage", 1.5, "kg"],
    ["carrots", 400, "g"],
    ["mayonnaise", 250, "ml"],
  ]);
  assert.deepEqual(unscalableLines(clean), []);
  assert.equal(unscalableWarning(clean), "");
});

function recipe(name: string, rows: [string, number, string][]): Recipe {
  return {
    name,
    serves: 12,
    method: null,
    notes: null,
    ingredients: rows.map(([item, qty, unit]) => ({
      item,
      qty,
      unit,
      category: "Dry goods" as Category,
    })),
  };
}
