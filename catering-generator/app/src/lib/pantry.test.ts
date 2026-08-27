import assert from "node:assert/strict";
import test from "node:test";

import { applyStock, stockedCount } from "./pantry.ts";
import type { Category, OrderLine, StockItem } from "./types.ts";

test("a line the pantry can part-answer says what's left to buy", () => {
  const [out] = applyStock(
    [order({ item: "Beef brisket", qty: 6.5, unit: "kg", rawQty: 6.5 })],
    [stock({ item: "beef brisket", qty: 2, unit: "kg" })],
  );
  assert.equal(out.inStock?.have, 2);
  assert.equal(out.inStock?.buy, 4.5);
  assert.equal(out.inStock?.covered, false);
});

test("the order line is never quietly reduced", () => {
  // The job still needs 6.5 kg. A pantry count is a memory of a Tuesday, and
  // by Friday someone has used it for staff lunch. Show all three numbers and
  // let the cook decide which to trust.
  const [out] = applyStock(
    [order({ item: "Beef brisket", qty: 6.5, unit: "kg", rawQty: 6.5 })],
    [stock({ item: "beef brisket", qty: 2, unit: "kg" })],
  );
  assert.equal(out.qty, 6.5, "the amount the job needs is untouched");
  assert.equal(out.unit, "kg");
});

test("enough in the pantry means nothing to buy", () => {
  const [out] = applyStock(
    [order({ item: "Plain flour", qty: 2, unit: "kg", rawQty: 2 })],
    [stock({ item: "plain flour", qty: 5, unit: "kg" })],
  );
  assert.equal(out.inStock?.covered, true);
  assert.equal(out.inStock?.buy, 0);
});

test("kilos in the pantry answer a line in grams", () => {
  const [out] = applyStock(
    [order({ item: "Butter", qty: 900, unit: "g", rawQty: 900 })],
    [stock({ item: "butter", qty: 0.5, unit: "kg" })],
  );
  // 500 g on hand against 900 g needed.
  assert.equal(out.inStock?.buy, 400);
  assert.equal(out.inStock?.haveUnit, "kg", "shown in the unit you counted it in");
});

test("units that aren't the same measure are never subtracted", () => {
  // 2 kg of cabbage in the coolroom against a line reading 3 cabbages. How
  // many cabbages that is depends on the cabbages. Say there's some and leave
  // the judgement to the cook.
  const [out] = applyStock(
    [order({ item: "Green cabbage", qty: 3, unit: "cabbages", rawQty: 3 })],
    [stock({ item: "green cabbage", qty: 2, unit: "kg" })],
  );
  assert.equal(out.inStock?.buy, null);
  assert.equal(out.inStock?.covered, false);
  assert.equal(out.inStock?.have, 2);
});

test("a pantry line matches the ingredient without its preparation", () => {
  // Recipes are written "item, prep". Nobody keeps a pantry that way — you
  // have carrots, and what you do to them is the job's business.
  const [out] = applyStock(
    [order({ item: "Carrots, grated", qty: 15, unit: "carrots", rawQty: 15 })],
    [stock({ item: "carrots", qty: 6, unit: "carrots" })],
  );
  assert.equal(out.inStock?.buy, 9);
});

test("the exact name beats the looser match", () => {
  const [out] = applyStock(
    [order({ item: "Carrots, grated", qty: 10, unit: "kg", rawQty: 10 })],
    [
      stock({ item: "carrots", qty: 1, unit: "kg" }),
      stock({ item: "carrots, grated", qty: 4, unit: "kg" }),
    ],
  );
  assert.equal(out.inStock?.have, 4, "the pantry line naming the exact thing wins");
});

test("a loose match never reaches across different ingredients", () => {
  // "Carrots" must not answer for "Carrot cake mix". A false match here means
  // turning up to a job short.
  const [out] = applyStock(
    [order({ item: "Carrot cake mix", qty: 3, unit: "kg", rawQty: 3 })],
    [stock({ item: "carrots", qty: 5, unit: "kg" })],
  );
  assert.equal(out.inStock, undefined);
});

test("nothing in the pantry leaves every line exactly as it was", () => {
  const lines = [order({ item: "Beef brisket", qty: 6.5, unit: "kg" })];
  assert.equal(applyStock(lines, []), lines);
});

test("a zero or nonsense stock count is ignored", () => {
  for (const bad of [0, -3, Number.NaN]) {
    const [out] = applyStock(
      [order({ item: "Flour", qty: 2, unit: "kg", rawQty: 2 })],
      [stock({ item: "flour", qty: bad, unit: "kg" })],
    );
    assert.equal(out.inStock, undefined, `${bad} should not mark the line`);
  }
});

test("the shortfall is rounded to something a supplier can pick", () => {
  // 6.47 kg needed, 2 kg on hand: 4.47, shown as 4.5 — the same half-kilo
  // steps the order line itself uses above 2 kg.
  const [out] = applyStock(
    [order({ item: "Beef brisket", qty: 6.5, unit: "kg", rawQty: 6.47 })],
    [stock({ item: "beef brisket", qty: 2, unit: "kg" })],
  );
  assert.equal(out.inStock?.buy, 4.5);
});

test("the shortfall works off the unrounded figure, not the rounded one", () => {
  const [out] = applyStock(
    [order({ item: "Cream", qty: 3, unit: "L", rawQty: 2.8 })],
    [stock({ item: "cream", qty: 1, unit: "L" })],
  );
  assert.equal(out.inStock?.buy, 1.8, "2.8 needed less 1 on hand");
});

test("how many lines the pantry answers for is countable", () => {
  const out = applyStock(
    [
      order({ item: "Beef brisket", qty: 6, unit: "kg", rawQty: 6 }),
      order({ item: "Flour", qty: 2, unit: "kg", rawQty: 2 }),
      order({ item: "Saffron", qty: 5, unit: "g", rawQty: 5 }),
    ],
    [
      stock({ item: "beef brisket", qty: 2, unit: "kg" }),
      stock({ item: "flour", qty: 9, unit: "kg" }),
    ],
  );
  assert.equal(stockedCount(out), 2);
});

function order(partial: Partial<OrderLine> & { category?: Category }): OrderLine {
  return {
    item: "thing",
    qty: 1,
    unit: "kg",
    category: "Dry goods",
    forDish: "A dish",
    basis: "original basis",
    ...partial,
  };
}

function stock(partial: Partial<StockItem>): StockItem {
  return { item: "thing", qty: 1, unit: "kg", ...partial };
}
