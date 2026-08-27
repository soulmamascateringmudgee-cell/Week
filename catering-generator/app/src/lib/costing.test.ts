import assert from "node:assert/strict";
import { test } from "node:test";

import { costOrders, quantityInPricedUnit } from "./costing.ts";
import type { IngredientPrice, OrderLine } from "./types.ts";

const line = (over: Partial<OrderLine>): OrderLine => ({
  item: "Bacon",
  qty: 2,
  unit: "kg",
  category: "Meat/Seafood",
  forDish: "Quiche",
  basis: "",
  ...over,
});

const PRICES: IngredientPrice[] = [
  { item: "bacon", unit: "kg", price: 18.5 },
  { item: "cream", unit: "L", price: 6 },
];

test("costs a line and works out the cost per head", () => {
  const costing = costOrders([line({ qty: 2 })], PRICES, 20);
  assert.equal(costing.total, 37);
  assert.equal(costing.perHead, 1.85);
  assert.equal(costing.complete, true);
});

test("converts grams against a per-kilo price", () => {
  assert.equal(quantityInPricedUnit(450, "g", "kg"), 0.45);
  assert.equal(quantityInPricedUnit(500, "ml", "L"), 0.5);
  const costing = costOrders([line({ qty: 450, unit: "g" })], PRICES, 10);
  assert.equal(costing.total, 8.33);
});

test("matches on the name however it was capitalised", () => {
  const costing = costOrders([line({ item: "  BACON " })], PRICES, 10);
  assert.equal(costing.priced.length, 1);
});

test("costs the unrounded quantity, not the rounded one", () => {
  // The order sheet shows 2.5 kg; the true figure is 2.46.
  const costing = costOrders([line({ qty: 2.5, rawQty: 2.46 })], PRICES, 10);
  assert.equal(costing.total, 45.51);
});

test("an unpriced ingredient is named, not silently skipped", () => {
  const costing = costOrders(
    [line({}), line({ item: "Parsley", qty: 2, unit: "bunches" })],
    PRICES,
    10,
  );
  assert.deepEqual(costing.unpriced, ["Parsley"]);
  assert.equal(costing.complete, false);
});

test("a price in an unreconcilable unit is flagged rather than guessed", () => {
  const costing = costOrders(
    [line({ item: "Bacon", qty: 3, unit: "bunches" })],
    PRICES,
    10,
  );
  assert.equal(costing.total, 0);
  assert.equal(costing.mismatched.length, 1);
  assert.match(costing.mismatched[0], /priced per kg, ordered in bunches/);
});

test("a partial total is never called under budget", () => {
  const costing = costOrders(
    [line({ qty: 1 }), line({ item: "Parsley", unit: "bunches" })],
    PRICES,
    10,
    1000,
  );
  // $18.50 of a $1000 budget, but something is missing — so it's incomplete,
  // not "under". Quoting off a partial total is how you work for nothing.
  assert.equal(costing.verdict, "incomplete");
});

test("a complete total is judged against the budget", () => {
  assert.equal(costOrders([line({ qty: 1 })], PRICES, 10, 100).verdict, "under");
  assert.equal(costOrders([line({ qty: 10 })], PRICES, 10, 100).verdict, "over");
});

test("no budget means no verdict, but still a cost", () => {
  const costing = costOrders([line({ qty: 1 })], PRICES, 10);
  assert.equal(costing.verdict, "no-budget");
  assert.equal(costing.total, 18.5);
});

test("the dearest lines come first — that's where the money is", () => {
  const costing = costOrders(
    [line({ item: "Cream", qty: 1, unit: "L" }), line({ qty: 3 })],
    PRICES,
    10,
  );
  assert.equal(costing.priced[0].item, "Bacon");
});

// ---------------------------------------------------------------- shops
//
// One ingredient, several shops. Mudgee has no wholesaler for half a catering
// list, so the same job gets shopped across Woolworths, Coles and Aldi.

const SHOPS: IngredientPrice[] = [
  { item: "bacon", unit: "kg", price: 22, supplier: "Woolworths" },
  { item: "bacon", unit: "kg", price: 19.5, supplier: "Coles" },
  { item: "bacon", unit: "kg", price: 16, supplier: "Aldi" },
];

test("the cheapest shop is the one costed", () => {
  const costing = costOrders([line({ qty: 2 })], SHOPS, 10);
  assert.equal(costing.total, 32);
  assert.equal(costing.priced[0].supplier, "Aldi");
});

test("the line says which shop, because a total you can't act on is no plan", () => {
  const costing = costOrders([line({ qty: 2 })], SHOPS, 10);
  assert.match(costing.priced[0].basis, /at Aldi/);
});

test("what shopping around saves is reported", () => {
  // 2 kg at Aldi's $16 against Woolworths' $22 — $12 on this line alone.
  const costing = costOrders([line({ qty: 2 })], SHOPS, 10);
  assert.equal(costing.savedByShopping, 12);
  assert.equal(costing.priced[0].dearestCost, 44);
});

test("one shop is not a choice, so no saving is claimed", () => {
  const costing = costOrders([line({ qty: 2 })], PRICES, 10);
  assert.equal(costing.savedByShopping, 0);
  assert.equal(costing.priced[0].dearestCost, undefined);
});

test("cheapest never means comparing units that don't line up", () => {
  // $2 a bunch looks cheaper than $8 a kilo and is not a comparison anyone
  // can make. The per-bunch price is dropped, not treated as the winner.
  const costing = costOrders(
    [line({ item: "Parsley", qty: 1, unit: "kg" })],
    [
      { item: "parsley", unit: "bunches", price: 2, supplier: "Coles" },
      { item: "parsley", unit: "kg", price: 8, supplier: "Aldi" },
    ],
    10,
  );
  assert.equal(costing.total, 8);
  assert.equal(costing.priced[0].supplier, "Aldi");
  assert.equal(costing.savedByShopping, 0, "one comparable price is no choice");
});

test("an item priced only in an unusable unit is still a mismatch", () => {
  const costing = costOrders(
    [line({ item: "Parsley", qty: 1, unit: "kg" })],
    [{ item: "parsley", unit: "bunches", price: 2, supplier: "Coles" }],
    10,
  );
  assert.equal(costing.priced.length, 0);
  assert.equal(costing.mismatched.length, 1);
  assert.equal(costing.complete, false);
});

test("shop prices in different but convertible units still compare", () => {
  // Aldi priced per 100 g, Coles per kg. $1.40/100 g is $14/kg — dearer.
  const costing = costOrders(
    [line({ item: "Chorizo", qty: 1, unit: "kg" })],
    [
      { item: "chorizo", unit: "kg", price: 12, supplier: "Coles" },
      { item: "chorizo", unit: "g", price: 0.014, supplier: "Aldi" },
    ],
    10,
  );
  assert.equal(costing.total, 12);
  assert.equal(costing.priced[0].supplier, "Coles");
});
