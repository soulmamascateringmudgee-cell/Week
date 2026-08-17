import assert from "node:assert/strict";
import { test } from "node:test";

import {
  describeChange,
  normaliseUnit,
  toUnitPrice,
  worthMentioning,
} from "./price-change.ts";

test("a plain per-kilo line comes back as a per-kilo price", () => {
  assert.deepEqual(
    toUnitPrice({ item: "Brisket", qty: 12.5, unit: "kg", lineTotal: 231.25 }),
    { item: "brisket", price: 18.5, unit: "kg" },
  );
});

// The whole point of normalising: an invoice billed in grams and a price list
// kept in kilos are the same price, and comparing them raw reports a 1000x rise.
test("grams become a per-kilo price", () => {
  assert.deepEqual(
    toUnitPrice({ item: "Almonds", qty: 400, unit: "g", lineTotal: 9.2 }),
    { item: "almonds", price: 23, unit: "kg" },
  );
});

test("millilitres become a per-litre price", () => {
  assert.deepEqual(
    toUnitPrice({ item: "Olive oil", qty: 4000, unit: "ml", lineTotal: 52 }),
    { item: "olive oil", price: 13, unit: "L" },
  );
});

test("counted units are left alone", () => {
  assert.deepEqual(
    toUnitPrice({ item: "Broccolini", qty: 6, unit: "bunches", lineTotal: 17.4 }),
    { item: "broccolini", price: 2.9, unit: "bunches" },
  );
});

test("units are matched whatever their case or spacing", () => {
  assert.equal(normaliseUnit(" KG "), "kg");
  assert.equal(normaliseUnit("Ml"), "L");
  assert.equal(normaliseUnit("Bunches"), "bunches");
});

// A divide by zero would produce Infinity and put it straight on a price list.
test("a zero or missing quantity produces nothing rather than infinity", () => {
  assert.equal(toUnitPrice({ item: "x", qty: 0, unit: "kg", lineTotal: 10 }), null);
  assert.equal(
    toUnitPrice({ item: "x", qty: Number.NaN, unit: "kg", lineTotal: 10 }),
    null,
  );
});

test("a credit line produces nothing rather than a negative price", () => {
  assert.equal(
    toUnitPrice({ item: "x", qty: 2, unit: "kg", lineTotal: -14 }),
    null,
  );
});

test("the price is rounded to the cent, once", () => {
  const line = toUnitPrice({ item: "x", qty: 3, unit: "kg", lineTotal: 10 });
  assert.equal(line?.price, 3.33);
});

test("an ingredient with no price yet is new, not a rise", () => {
  const change = describeChange(null, { price: 18.5, unit: "kg" });
  assert.equal(change.kind, "new");
  assert.match(change.note, /New/);
});

test("a rise is reported with its percentage", () => {
  const change = describeChange({ price: 10, unit: "kg" }, { price: 12, unit: "kg" });
  assert.equal(change.kind, "up");
  assert.equal(change.percent, 20);
  assert.match(change.note, /Up 20%/);
});

test("a fall is reported as a fall", () => {
  const change = describeChange({ price: 10, unit: "kg" }, { price: 8, unit: "kg" });
  assert.equal(change.kind, "down");
  assert.equal(change.percent, -20);
  assert.match(change.note, /Down 20%/);
});

test("a price in grams matches a price list kept in kilos", () => {
  // $23/kg stored, invoice line 400 g for $9.20 — the same price.
  const line = toUnitPrice({ item: "Almonds", qty: 400, unit: "g", lineTotal: 9.2 });
  const change = describeChange({ price: 23, unit: "kg" }, line!);
  assert.equal(change.kind, "same");
});

test("a rounding-sized wobble is not news", () => {
  const change = describeChange(
    { price: 20, unit: "kg" },
    { price: 20.05, unit: "kg" },
  );
  assert.equal(change.kind, "same");
});

// Per-kilo against per-bunch is a different way of buying the thing. A
// percentage here would be invented, and invented numbers end up in quotes.
test("a changed unit is flagged, never turned into a percentage", () => {
  const change = describeChange(
    { price: 24, unit: "kg" },
    { price: 3, unit: "bunches" },
  );
  assert.equal(change.kind, "unit-changed");
  assert.equal(change.percent, undefined);
  assert.match(change.note, /check which is right/);
});

test("a price rising off zero doesn't produce an infinite percentage", () => {
  const change = describeChange({ price: 0, unit: "kg" }, { price: 12, unit: "kg" });
  assert.equal(change.kind, "up");
  assert.equal(change.percent, undefined);
  assert.ok(Number.isFinite(change.percent ?? 0));
});

test("unchanged lines are dropped and the biggest movers come first", () => {
  const rows = [
    { item: "a", change: describeChange({ price: 10, unit: "kg" }, { price: 11, unit: "kg" }) },
    { item: "b", change: describeChange({ price: 10, unit: "kg" }, { price: 10, unit: "kg" }) },
    { item: "c", change: describeChange({ price: 10, unit: "kg" }, { price: 14, unit: "kg" }) },
    { item: "d", change: describeChange({ price: 10, unit: "kg" }, { price: 6, unit: "kg" }) },
  ];
  assert.deepEqual(
    worthMentioning(rows).map((r) => r.item),
    ["c", "d", "a"],
  );
});

// Something needing a decision should not be buried under a bigger percentage.
test("things needing a decision outrank plain price moves", () => {
  const rows = [
    { item: "big rise", change: describeChange({ price: 10, unit: "kg" }, { price: 30, unit: "kg" }) },
    { item: "new one", change: describeChange(null, { price: 5, unit: "kg" }) },
    { item: "odd unit", change: describeChange({ price: 10, unit: "kg" }, { price: 3, unit: "bunches" }) },
  ];
  assert.deepEqual(
    worthMentioning(rows).map((r) => r.item),
    ["odd unit", "new one", "big rise"],
  );
});
