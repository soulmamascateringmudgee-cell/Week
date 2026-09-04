import assert from "node:assert/strict";
import test from "node:test";

import { combineOrders } from "./combine.ts";
import { costOrders } from "./costing.ts";
import { toWholeProduce } from "./produce.ts";
import type { Category, OrderLine } from "./types.ts";

test("produce weights come out as whole items you can pick up", () => {
  assert.deepEqual(
    toWholeProduce([
      order({ item: "Carrots, diced", qty: 380, unit: "g" }),
      order({ item: "Broccoli florets", qty: 900, unit: "g" }),
      order({ item: "Green cabbage, finely shredded", qty: 3, unit: "kg" }),
    ]).map((l) => `${l.qty} ${l.unit}`),
    ["4 carrots", "3 heads", "4 cabbages"],
  );
});

test("a part item is a whole item — you can't buy 0.6 of a cabbage", () => {
  const [line] = toWholeProduce([order({ item: "cabbage", qty: 200, unit: "g" })]);
  assert.equal(line.qty, 1);
  // "1 cabbages" is how you can tell a machine wrote the list.
  assert.equal(line.unit, "cabbage");
});

test("one of a thing is singular, more than one is plural", () => {
  const singular = toWholeProduce([
    order({ item: "Carrots", qty: 80, unit: "g" }),
    order({ item: "Broccoli", qty: 250, unit: "g" }),
    order({ item: "Parsley", qty: 20, unit: "g" }),
    order({ item: "Brown onions", qty: 100, unit: "g" }),
  ]);
  assert.deepEqual(
    singular.map((l) => `${l.qty} ${l.unit}`),
    ["1 carrot", "1 head", "1 bunch", "1 onion"],
  );

  const plural = toWholeProduce([
    order({ item: "Carrots", qty: 300, unit: "g" }),
    order({ item: "Broccoli", qty: 900, unit: "g" }),
    order({ item: "Parsley", qty: 80, unit: "g" }),
    order({ item: "Brown onions", qty: 500, unit: "g" }),
  ]);
  assert.deepEqual(
    plural.map((l) => `${l.qty} ${l.unit}`),
    ["3 carrots", "3 heads", "3 bunches", "4 onions"],
  );
});

test("the weight and the piece size are written into the basis", () => {
  const [line] = toWholeProduce([order({ item: "Carrots", qty: 380, unit: "g" })]);
  assert.match(line.basis, /380 g/);
  assert.match(line.basis, /100 g a carrot/);
  assert.match(line.basis, /rounded up/);
  // An average carrot is an estimate, and estimates say so.
  assert.equal(line.assumption, true);
});

test("a powder off a shelf is never turned into a vegetable", () => {
  // "Garlic powder" contains "garlic"; "onion powder" contains "onion". Both
  // are jars. Ordering 2 bulbs of garlic powder would be worse than grams.
  for (const item of [
    "garlic powder",
    "onion powder",
    "dried mint",
    "tinned corn kernels",
    "carrot juice",
    "frozen broccoli",
  ]) {
    const [line] = toWholeProduce([order({ item, qty: 500, unit: "g" })]);
    assert.equal(line.unit, "g", `${item} should stay in grams`);
    assert.equal(line.basis, "original basis", `${item} should be untouched`);
  }
});

test("the most specific piece wins", () => {
  // "spring onion" and "onion" both match; the longer key has to win or a
  // bunch of spring onions is ordered as loose brown onions.
  const [spring] = toWholeProduce([
    order({ item: "spring onions, sliced", qty: 180, unit: "g" }),
  ]);
  assert.equal(spring.unit, "bunches");

  const [brown] = toWholeProduce([order({ item: "brown onions", qty: 260, unit: "g" })]);
  assert.equal(brown.unit, "onions");
});

test("only produce is counted — a butcher still works in kilos", () => {
  const [line] = toWholeProduce([
    order({ item: "Beef brisket", qty: 6.5, unit: "kg", category: "Meat/Seafood" }),
  ]);
  assert.equal(line.unit, "kg");
  assert.equal(line.qty, 6.5);
});

test("produce we don't sell by the piece keeps its weight", () => {
  // 16 kg of potatoes is a bag. "160 potatoes" is a worse line, not a better
  // one, so anything not in the table is left alone.
  for (const item of ["Potatoes, peeled", "Cherry tomatoes", "Baby spinach"]) {
    const [line] = toWholeProduce([order({ item, qty: 4, unit: "kg" })]);
    assert.equal(line.unit, "kg", `${item} should stay in kilos`);
  }
});

test("a line already counted in bunches is left as it is", () => {
  const [line] = toWholeProduce([
    order({ item: "Parsley", qty: 3, unit: "bunches" }),
  ]);
  assert.equal(line.qty, 3);
  assert.equal(line.basis, "original basis");
});

test("a count of sprigs becomes a count of bunches", () => {
  // Straight off a real job sheet: 146 rosemary sprigs and 113 garlic cloves,
  // neither of which is a thing anyone sells.
  assert.deepEqual(
    toWholeProduce([
      order({ item: "Rosemary sprigs", qty: 146, unit: "ea" }),
      order({ item: "Garlic cloves", qty: 113, unit: "ea" }),
      order({ item: "Spring onions", qty: 12, unit: "ea" }),
    ]).map((l) => `${l.qty} ${l.unit}`),
    ["8 bunches", "12 bulbs", "2 bunches"],
  );
});

test("the sprig count and what's in a bunch are written into the basis", () => {
  const [line] = toWholeProduce([
    order({ item: "Rosemary sprigs", qty: 146, unit: "ea" }),
  ]);
  assert.match(line.basis, /146 sprigs/);
  assert.match(line.basis, /20 sprigs a bunch/);
  // What's in a bunch is an estimate, in exactly the way an average carrot is.
  assert.equal(line.assumption, true);
});

test("one bunch is a bunch, not 1 bunches", () => {
  const [line] = toWholeProduce([
    order({ item: "Thyme sprigs", qty: 6, unit: "ea" }),
  ]);
  assert.equal(line.qty, 1);
  assert.equal(line.unit, "bunch");
});

test("a herb counted in ea was counting bunches", () => {
  // "Parsley — 7 ea" is the recipe's own unit coming through. Seven sprigs or
  // seven bunches is a real question at the shop, and one parsley is one bunch.
  const [line] = toWholeProduce([order({ item: "Parsley", qty: 7, unit: "ea" })]);
  assert.equal(line.qty, 7, "the number is the recipe's, and it stands");
  assert.equal(line.unit, "bunches");
  assert.equal(line.assumption, true);
  assert.match(line.basis, /only sold in bunches/);
});

test("a jar is never turned into a bunch", () => {
  // "Dried oregano" and "garlic powder" both name a herb and neither grows in
  // a bunch. Same rule as the weights, applied to the counts.
  for (const item of ["Dried oregano", "Garlic powder", "Mint sauce"]) {
    const [line] = toWholeProduce([order({ item, qty: 4, unit: "ea" })]);
    assert.equal(line.unit, "ea", `${item} should be left alone`);
  }
});

test("things you genuinely buy one of stay in ea", () => {
  for (const item of ["Lemon", "Brown onion", "Long red chilli"]) {
    const [line] = toWholeProduce([order({ item, qty: 34, unit: "ea" })]);
    assert.equal(line.unit, "ea", `${item} should be left alone`);
  }
});

test("counting sprigs after combining buys one bunch, not two", () => {
  // The same rule the carrots follow, and the reason this runs after the
  // combine: 12 sprigs across two dishes is one bunch of thyme, not two.
  const perDish = [
    order({ item: "Thyme sprigs", qty: 6, unit: "ea", forDish: "Lamb" }),
    order({ item: "Thyme sprigs", qty: 6, unit: "ea", forDish: "Potatoes" }),
  ];
  const [line] = toWholeProduce(combineOrders(perDish));
  assert.equal(line.qty, 1);
  assert.equal(line.unit, "bunch");
});

test("counting after combining buys three carrots, not four", () => {
  // This is the whole reason it runs last. Two dishes wanting 1.2 carrots each
  // is 2.4 carrots — three. Rounding each dish up on its own buys four, and
  // does it again on every shared vegetable on the menu.
  const perDish = [
    order({ item: "Carrots", qty: 120, unit: "g", forDish: "Slaw" }),
    order({ item: "Carrots", qty: 120, unit: "g", forDish: "Soup" }),
  ];

  const rightWay = toWholeProduce(combineOrders(perDish));
  assert.equal(rightWay.length, 1);
  assert.equal(rightWay[0].qty, 3);

  const wrongWay = combineOrders(toWholeProduce(perDish));
  assert.equal(wrongWay[0].qty, 4, "guarding the order these run in");
});

test("a counted line drops its stale gram figure", () => {
  // rawQty is the unrounded number in grams. Left on a line counted in carrots,
  // anything totalling lines would add grams to carrots.
  const [line] = toWholeProduce([
    order({ item: "Carrots", qty: 380, unit: "g", rawQty: 384.2 }),
  ]);
  assert.equal(line.rawQty, undefined);
});

test("nothing is invented from a zero or a nonsense quantity", () => {
  for (const bad of [0, -2, Number.NaN, Number.POSITIVE_INFINITY]) {
    const [line] = toWholeProduce([order({ item: "Carrots", qty: bad, unit: "g" })]);
    assert.equal(line.unit, "g", `${bad} should be left alone`);
  }
});

test("costing has to run before the count, because prices are per kilo", () => {
  // The other half of why this runs last. A price list says carrots are $2.50
  // a kilo; it has nothing to say about the price of "15 carrots". Cost the
  // weights, then count for the shop.
  const lines = [order({ item: "Carrots", qty: 1477, unit: "g", rawQty: 1477 })];
  const prices = [{ item: "Carrots", unit: "kg", price: 2.5 }];

  const costedFirst = costOrders(lines, prices, 60);
  assert.equal(costedFirst.priced.length, 1);
  // 1.477 kg at $2.50 is $3.6925, carried as $3.69 — costing works in cents.
  assert.equal(costedFirst.total, 3.69);
  assert.deepEqual(costedFirst.mismatched, []);

  const costedAfter = costOrders(toWholeProduce(lines), prices, 60);
  assert.equal(costedAfter.priced.length, 0);
  assert.equal(costedAfter.mismatched.length, 1, "guarding the order these run in");
});

function order(partial: Partial<OrderLine> & { category?: Category }): OrderLine {
  return {
    item: "thing",
    qty: 1,
    unit: "g",
    category: "Produce",
    forDish: "A dish",
    basis: "original basis",
    ...partial,
  };
}
