import assert from "node:assert/strict";
import test from "node:test";

import { scaledToOrderUnits, toOrderMeasure, toOrderUnits } from "./measure.ts";
import { toWholeProduce } from "./produce.ts";
import type { OrderLine } from "./types.ts";

test("a buying unit is left exactly as it is", () => {
  for (const unit of ["kg", "g", "L", "ml", "ea", "bunches", "punnets"]) {
    const out = toOrderMeasure(4, unit, "beef brisket");
    assert.equal(out.unit, unit, unit);
    assert.equal(out.note, "", `${unit} should not be rewritten`);
    assert.equal(out.assumed, false);
  }
});

test("spoons and cups become millilitres at the Australian standard", () => {
  // The tablespoon is the one that matters: 20 ml here, 15 ml most other
  // places. A recipe copied off an American site is a third out.
  assert.deepEqual(pick(toOrderMeasure(9, "tbsp", "apple cider vinegar")), {
    qty: 180,
    unit: "ml",
  });
  assert.deepEqual(pick(toOrderMeasure(3, "tsp", "lemon juice")), {
    qty: 15,
    unit: "ml",
  });
  assert.deepEqual(pick(toOrderMeasure(2, "cup", "chicken stock")), {
    qty: 500,
    unit: "ml",
  });
});

test("a thousand millilitres and over is shown in litres", () => {
  assert.deepEqual(pick(toOrderMeasure(6, "cup", "chicken stock")), {
    qty: 1.5,
    unit: "L",
  });
});

test("an ingredient we know the weight of is ordered by weight", () => {
  // 17.9 tsp of garlic powder is not a thing you can buy. 54 g is a jar.
  const out = toOrderMeasure(17.9, "tsp", "garlic powder");
  assert.equal(out.unit, "g");
  assert.ok(out.qty > 50 && out.qty < 58, `expected about 54 g, got ${out.qty}`);
});

test("a weight worked out from a density is marked as an assumption", () => {
  // Densities are estimates. The number is useful; presenting it as measured
  // would not be.
  const weighed = toOrderMeasure(17.9, "tsp", "garlic powder");
  assert.equal(weighed.assumed, true);
  assert.match(weighed.note, /g per ml/);

  // An exact volume conversion is arithmetic, not an estimate.
  const poured = toOrderMeasure(9, "tbsp", "apple cider vinegar");
  assert.equal(poured.assumed, false);
});

test("a big volume of a known dry good comes out in kilos", () => {
  // 41.8 cups of shredded cabbage — the number that started all this.
  const out = toOrderMeasure(41.8, "cup", "green cabbage, finely shredded");
  assert.equal(out.unit, "kg");
  assert.ok(out.qty > 2.5 && out.qty < 3.5, `expected about 3 kg, got ${out.qty}`);
});

test("the most specific density wins", () => {
  // "brown sugar" and "sugar" both match; the longer key has to win or every
  // sugar in the book weighs the same.
  const brown = toOrderMeasure(1, "cup", "brown sugar");
  const caster = toOrderMeasure(1, "cup", "caster sugar");
  assert.notEqual(brown.qty, caster.qty);
});

test("an ingredient we have no density for stays in millilitres", () => {
  // Better an awkward volume than an invented weight.
  const out = toOrderMeasure(3, "cup", "pomegranate molasses");
  assert.equal(out.unit, "ml");
  assert.equal(out.assumed, false);
});

test("nothing is invented from a zero or a nonsense quantity", () => {
  for (const bad of [0, -2, Number.NaN, Number.POSITIVE_INFINITY]) {
    const out = toOrderMeasure(bad, "cup", "flour");
    assert.equal(out.unit, "cup", `${bad} should be left alone`);
    assert.equal(out.note, "");
  }
});

test("the conversion is written into the basis so it can be checked", () => {
  const [line] = toOrderUnits([order({ item: "apple cider vinegar", qty: 9, unit: "tbsp" })]);
  assert.equal(line.unit, "ml");
  assert.match(line.basis, /20 ml/);
  assert.match(line.basis, /original basis/);
});

test("converting before combining lets the same ingredient add up", () => {
  // Three tablespoons in one dish and half a cup in another are one bottle of
  // vinegar, not two lines nobody totals.
  const converted = toOrderUnits([
    order({ item: "apple cider vinegar", qty: 3, unit: "tbsp" }),
    order({ item: "apple cider vinegar", qty: 0.5, unit: "cup" }),
  ]);
  // Half a cup is 125 ml, shown as 130 — millilitres round to tens above 100,
  // which is the existing rule for something a supplier can actually pick.
  // The point here is that both rows are now in the same unit and will total.
  assert.deepEqual(
    converted.map((l) => `${l.qty} ${l.unit}`),
    ["60 ml", "130 ml"],
  );
});

test("a converted line drops its stale pre-rounding figure", () => {
  // rawQty is the unrounded number in the OLD unit. Carrying it into a new
  // unit would have anything that totals lines adding millilitres to cups.
  const [line] = toOrderUnits([
    order({ item: "flour", qty: 2, unit: "cup", rawQty: 2.04 }),
  ]);
  assert.equal(line.unit, "g");
  assert.equal(line.rawQty, undefined);
});

test("an untouched line keeps its pre-rounding figure", () => {
  const [line] = toOrderUnits([
    order({ item: "beef brisket", qty: 6.5, unit: "kg", rawQty: 6.47 }),
  ]);
  assert.equal(line.rawQty, 6.47);
  assert.equal(line.basis, "original basis");
});

test("a dish's own sheet is converted the same way", () => {
  assert.deepEqual(
    scaledToOrderUnits([
      { item: "garlic powder", qty: 17.9, unit: "tsp" },
      { item: "beef brisket", qty: 6.5, unit: "kg" },
    ]).map((i) => i.unit),
    ["g", "kg"],
  );
});

test("fresh produce given in cups is weighed, not left in millilitres", () => {
  // "960 ml of coriander" is not a line anybody can shop from, and it was
  // worse than unreadable: produce is only counted into bunches and onions
  // once it is a weight, so a line left in millilitres was skipped entirely.
  assert.equal(toOrderMeasure(1, "cup", "coriander leaves, chopped").unit, "g");
  assert.equal(toOrderMeasure(1, "cup", "finely chopped white onion").unit, "g");
  assert.equal(toOrderMeasure(2, "tbsp", "finely chopped jalapeño").unit, "g");

  // A density is an estimate and says so, so the basis line can be argued with.
  assert.equal(toOrderMeasure(1, "cup", "coriander leaves").assumed, true);
});

test("a longer name still beats the general one it contains", () => {
  // Adding "coriander" and "onion" must not capture the dried and powdered
  // forms, which are several times denser and are not sold in bunches.
  assert.equal(toOrderMeasure(1, "cup", "ground coriander").qty, 100); // 250 × 0.4
  assert.equal(toOrderMeasure(1, "cup", "onion powder").qty, 120); // 250 × 0.48
  assert.equal(toOrderMeasure(1, "cup", "tomato paste").qty, 280); // 250 × 1.1, to the nearest 10 g
});

test("a cup of chopped onion reaches the shopping list as onions", () => {
  // The whole chain, because each half is useless without the other: cups to
  // grams here, grams to things you pick up in produce.ts.
  const [onions] = toWholeProduce([
    order({ item: "Finely chopped white onion", ...pick(toOrderMeasure(3, "cup", "finely chopped white onion")) }),
  ]);
  assert.equal(onions.unit, "onions");
  assert.equal(onions.qty, 4); // 750 ml × 0.64 = 480 g, at 130 g an onion

  const [herbs] = toWholeProduce([
    order({ item: "Coriander leaves, chopped", ...pick(toOrderMeasure(1, "cup", "coriander leaves, chopped")) }),
  ]);
  assert.equal(herbs.unit, "bunches");
  assert.equal(herbs.qty, 2); // 250 ml × 0.16 = 40 g, at 30 g a bunch
});

function pick(measure: { qty: number; unit: string }) {
  return { qty: measure.qty, unit: measure.unit };
}

function order(partial: Partial<OrderLine>): OrderLine {
  return {
    item: "thing",
    qty: 1,
    unit: "ea",
    category: "Produce",
    forDish: "A dish",
    basis: "original basis",
    ...partial,
  };
}
