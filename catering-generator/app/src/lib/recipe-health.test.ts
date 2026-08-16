import assert from "node:assert/strict";
import { test } from "node:test";

import { hasUnscalableAmounts, unscalableWarning } from "./recipe-health.ts";
import type { Recipe } from "./types.ts";

const recipe = (name: string, ingredients: Recipe["ingredients"]): Recipe => ({
  name,
  serves: 30,
  ingredients,
});

// The real thing, straight off a bad import.
const BROKEN = recipe("Pork and fennel sausage rolls", [
  { item: "Olive oil: 3/4 tbsp", qty: 1, unit: "ea", category: "Dry goods" },
  { item: "Garlic: 3 cloves", qty: 1, unit: "ea", category: "Produce" },
  { item: "Bacon: 225g", qty: 1, unit: "ea", category: "Meat/Seafood" },
  { item: "Pork mince: 750g", qty: 1, unit: "ea", category: "Meat/Seafood" },
  { item: "Puff pastry: 4 sheets", qty: 1, unit: "ea", category: "Dry goods" },
]);

const GOOD = recipe("Pork & fennel sausage rolls", [
  { item: "Pork mince", qty: 750, unit: "g", category: "Meat/Seafood" },
  { item: "Bacon", qty: 225, unit: "g", category: "Meat/Seafood" },
  { item: "Brown onion", qty: 2, unit: "ea", category: "Produce" },
  { item: "Puff pastry sheets", qty: 4, unit: "ea", category: "Dry goods" },
]);

test("spots a recipe whose amounts are stuck in the ingredient names", () => {
  assert.equal(hasUnscalableAmounts(BROKEN), true);
});

test("leaves a properly written recipe alone", () => {
  assert.equal(hasUnscalableAmounts(GOOD), false);
});

test("a genuine single item is not a broken import", () => {
  // "1 ea Whole chicken" is exactly right, and carries no amount in its name.
  assert.equal(
    hasUnscalableAmounts(
      recipe("Roast chicken", [
        { item: "Whole chicken", qty: 1, unit: "ea", category: "Meat/Seafood" },
        { item: "Butter", qty: 200, unit: "g", category: "Dairy" },
        { item: "Lemon", qty: 2, unit: "ea", category: "Produce" },
        { item: "Garlic bulb", qty: 1, unit: "ea", category: "Produce" },
      ]),
    ),
    false,
  );
});

test("a very short recipe is not judged", () => {
  assert.equal(
    hasUnscalableAmounts(
      recipe("Chilli jam", [
        { item: "Chillies: 80g", qty: 1, unit: "ea", category: "Produce" },
        { item: "Sugar: 150g", qty: 1, unit: "ea", category: "Dry goods" },
      ]),
    ),
    false,
  );
});

test("the warning names the dish and quotes a line from it", () => {
  const message = unscalableWarning(BROKEN);
  assert.match(message, /Pork and fennel sausage rolls/);
  assert.match(message, /Olive oil: 3\/4 tbsp/);
  assert.match(message, /Amount and Unit columns/);
});
