import assert from "node:assert/strict";
import { test } from "node:test";

import { formatAmount } from "./round.ts";
import { asSpoons, spoonedAs, toSpoonMeasures } from "./spoons.ts";
import type { OrderLine } from "./types.ts";

function line(over: Partial<OrderLine> & Pick<OrderLine, "item" | "qty" | "unit">): OrderLine {
  return {
    category: "Dry goods",
    basis: "test",
    dishes: [],
    assumption: false,
    ...over,
  } as OrderLine;
}

// --- What counts as a spice -------------------------------------------------

test("the spices she named are spooned", () => {
  assert.equal(spoonedAs("Smoked paprika"), "smoked paprika");
  assert.equal(spoonedAs("Garlic powder"), "garlic powder");
});

test("the plant is not the spice", () => {
  // The whole difficulty of this list. Getting either of these wrong puts a
  // vegetable on the sheet in teaspoons, or a spice in kilos.
  assert.equal(spoonedAs("Garlic cloves"), null);
  assert.equal(spoonedAs("Garlic"), null);
  assert.equal(spoonedAs("Red onion"), null);
  assert.equal(spoonedAs("Fresh chilli"), null);
  assert.equal(spoonedAs("Coriander"), null);
  assert.equal(spoonedAs("Fresh thyme"), null);

  assert.equal(spoonedAs("Onion powder"), "onion powder");
  assert.equal(spoonedAs("Chilli powder"), "chilli powder");
  assert.equal(spoonedAs("Ground coriander"), "ground coriander");
  assert.equal(spoonedAs("Dried thyme"), "dried thyme");
});

test("whole seeds are spooned, and they know what they weigh", () => {
  // "Fennel seeds — 13 g" was on a real sheet: named as a spice, but with no
  // density there was no way back to a spoon and the grams stood.
  const [seeds] = toSpoonMeasures([
    line({ item: "Fennel seeds", qty: 13, rawQty: 13, unit: "g" }),
  ]);
  assert.equal(formatAmount(seeds.qty, seeds.unit), "1¾");
  assert.equal(seeds.unit, "tbsp");
});

test("a jar of mustard is spoons at the bench and grams at the shop", () => {
  const [small] = toSpoonMeasures([
    line({ item: "Dijon Mustard ((or other non spicy smooth mustard))", qty: 21, unit: "ml" }),
  ]);
  assert.equal(small.qty, 1);
  assert.equal(small.unit, "tbsp");

  // Past the spoon ceiling it goes back to weight, not volume — a jar is
  // labelled 215 g and priced by the kilo, and nothing on the shelf says ml.
  const [big] = toSpoonMeasures([
    line({ item: "Dijon mustard", qty: 400, rawQty: 400, unit: "g" }),
  ]);
  assert.equal(big.unit, "g");
});

test("mustard greens are not mustard", () => {
  // Bare "mustard" is deliberately not on the list. A leafy green measured in
  // teaspoons is the same failure as a block of butter measured in them.
  assert.equal(spoonedAs("Mustard greens"), null);
  assert.equal(spoonedAs("Dijon mustard"), "dijon mustard");
});

test("a name is matched by whole words, not by its letters", () => {
  // "salt" inside "salted butter" is the failure this guards: a block of
  // butter measured in teaspoons.
  assert.equal(spoonedAs("Salted butter"), null);
  assert.equal(spoonedAs("Salted peanuts"), null);
  assert.equal(spoonedAs("Salt"), "salt");
  assert.equal(spoonedAs("Sea salt flakes"), "sea salt");
});

test("the longest matching name wins", () => {
  assert.equal(spoonedAs("Smoked paprika"), "smoked paprika");
  assert.equal(spoonedAs("Celery salt"), "celery salt");
});

// --- Choosing the spoon -----------------------------------------------------

test("small amounts are teaspoons, larger ones tablespoons", () => {
  assert.deepEqual(asSpoons(5), { qty: 1, unit: "tsp" });
  assert.deepEqual(asSpoons(15), { qty: 3, unit: "tsp" });
  // Four teaspoons is a tablespoon, and one scoop beats four.
  assert.deepEqual(asSpoons(20), { qty: 1, unit: "tbsp" });
  assert.deepEqual(asSpoons(100), { qty: 5, unit: "tbsp" });
});

test("amounts round to a quarter, because that is what a spoon has on it", () => {
  assert.deepEqual(asSpoons(6), { qty: 1.25, unit: "tsp" });
  assert.deepEqual(asSpoons(12.5), { qty: 2.5, unit: "tsp" });
  assert.deepEqual(asSpoons(90), { qty: 4.5, unit: "tbsp" });
});

test("a pinch is a quarter teaspoon, not nothing", () => {
  assert.deepEqual(asSpoons(0.4), { qty: 0.25, unit: "tsp" });
});

test("past eight tablespoons a spoon is the wrong tool", () => {
  assert.deepEqual(asSpoons(160), { qty: 8, unit: "tbsp" });
  assert.equal(asSpoons(161), null);
  assert.equal(asSpoons(700), null);
});

// --- Whole lines ------------------------------------------------------------

test("grams of paprika come back as spoons", () => {
  // 46 g at 0.46 g/ml is 100 ml, which is five tablespoons.
  const [row] = toSpoonMeasures([
    line({ item: "Smoked paprika", qty: 46, unit: "g" }),
  ]);
  assert.equal(row.qty, 5);
  assert.equal(row.unit, "tbsp");
  assert.match(row.basis, /measured at 20 ml a tablespoon/);
});

test("a weight the app inferred says so", () => {
  const [row] = toSpoonMeasures([
    line({ item: "Garlic powder", qty: 12, unit: "g" }),
  ]);
  assert.equal(row.assumption, true, "a density was used, so it is an estimate");
});

test("millilitres convert without any estimate at all", () => {
  // Nothing is guessed going from a volume to a spoon — it is arithmetic.
  const [row] = toSpoonMeasures([
    line({ item: "Vanilla extract", qty: 10, unit: "ml" }),
  ]);
  assert.equal(row.qty, 2);
  assert.equal(row.unit, "tsp");
  assert.equal(row.assumption, false);
});

test("a big job keeps its weight", () => {
  // 460 g of paprika is a litre of the stuff. Fifty tablespoons is not help.
  const [row] = toSpoonMeasures([
    line({ item: "Smoked paprika", qty: 460, unit: "g" }),
  ]);
  assert.equal(row.qty, 460);
  assert.equal(row.unit, "g");
});

test("things you weigh are left alone", () => {
  const rows = toSpoonMeasures([
    line({ item: "Beef brisket", qty: 12, unit: "kg" }),
    line({ item: "Plain flour", qty: 800, unit: "g" }),
    line({ item: "Carrots", qty: 4, unit: "ea" }),
  ]);
  assert.deepEqual(
    rows.map((r) => `${r.qty} ${r.unit}`),
    ["12 kg", "800 g", "4 ea"],
  );
});

test("a spice with no density and no volume is left alone", () => {
  // Nothing to convert from, so the row stands rather than being invented.
  const [row] = toSpoonMeasures([
    line({ item: "Sesame seeds", qty: 3, unit: "ea" }),
  ]);
  assert.equal(row.unit, "ea");
});

// --- How it reads -----------------------------------------------------------

test("quarters print as fractions, not decimals", () => {
  assert.equal(formatAmount(0.25, "tsp"), "¼");
  assert.equal(formatAmount(0.5, "tsp"), "½");
  assert.equal(formatAmount(1.25, "tsp"), "1¼");
  assert.equal(formatAmount(2.75, "tbsp"), "2¾");
  assert.equal(formatAmount(3, "tsp"), "3");
});

test("weights stay decimal, where a decimal is what the scale says", () => {
  assert.equal(formatAmount(1.25, "kg"), "1.25");
  assert.equal(formatAmount(460, "g"), "460");
});
