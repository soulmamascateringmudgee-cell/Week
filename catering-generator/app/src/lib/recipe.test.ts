import assert from "node:assert/strict";
import { test } from "node:test";

import { planEvent } from "./event-engine.ts";
import { extractRecipe, parseYield } from "./recipe-import.ts";
import { parseIngredientLine, parseIngredients } from "./recipe-parse.ts";
import type { EventInput, Recipe } from "./types.ts";

// ------------------------------------------------------------------ parsing

test("reads the shapes recipes are actually written in", () => {
  assert.deepEqual(parseIngredientLine("5 kg beef brisket"), {
    item: "beef brisket",
    qty: 5,
    unit: "kg",
    category: "Meat/Seafood",
  });

  assert.deepEqual(parseIngredientLine("500g butter"), {
    item: "butter",
    qty: 500,
    unit: "g",
    category: "Dairy",
  });

  assert.deepEqual(parseIngredientLine("- 2 bunches broccolini"), {
    item: "broccolini",
    qty: 2,
    unit: "bunches",
    category: "Produce",
  });

  assert.deepEqual(parseIngredientLine("1.5 L cream"), {
    item: "cream",
    qty: 1.5,
    unit: "L",
    category: "Dairy",
  });
});

test("multiplies a pack size out", () => {
  assert.deepEqual(parseIngredientLine("3 x 400g tinned tomatoes"), {
    item: "tinned tomatoes",
    qty: 1200,
    unit: "g",
    category: "Produce",
  });
});

test("understands fractions", () => {
  assert.equal(parseIngredientLine("1/2 cup olive oil")?.qty, 0.5);
  assert.equal(parseIngredientLine("1 1/2 kg carrots")?.qty, 1.5);
});

test("keeps a line that has no quantity rather than dropping it", () => {
  const parsed = parseIngredientLine("Salt and pepper");
  assert.equal(parsed?.item, "Salt and pepper");
  assert.equal(parsed?.qty, 1);
});

test("skips blank lines and strips list markers", () => {
  const rows = parseIngredients("5 kg brisket\n\n  \n* 2 bunches kale\n");
  assert.equal(rows.length, 2);
  assert.equal(rows[1].item, "kale");
});

// ------------------------------------------------------------------ scaling

const BASE: EventInput = {
  guests: 100,
  eventDate: "2026-03-14",
  today: "2026-03-01",
  style: "shared",
  menuWeight: "standard",
  proteins: ["brisket"],
  sidesCount: 0,
  starch: "none",
  bread: false,
  dessert: "none",
  grazing: "none",
  canapes: "none",
  drinksService: false,
  hotOrOutdoors: false,
  dietaries: [],
};

const SLAW: Recipe = {
  name: "Fennel slaw",
  serves: 10,
  ingredients: [
    { item: "Fennel", qty: 2, unit: "kg", category: "Produce" },
    { item: "Mayonnaise", qty: 400, unit: "g", category: "Dairy" },
    { item: "Lemons", qty: 3, unit: "ea", category: "Produce" },
  ],
};

test("scales a recipe off the headcount, crew and buffer", () => {
  const plan = planEvent({ ...BASE, recipes: [SLAW] });
  // 100 guests + 2 crew = 102, ×1.05 buffer = 107.1, ÷ 10 served = 10.71
  const fennel = plan.orders.find((line) => line.item === "Fennel");
  assert.equal(fennel?.qty, 21.5); // 2 kg × 10.71 = 21.42 → nearest half kilo
  assert.equal(fennel?.forDish, "Fennel slaw");

  const mayo = plan.orders.find((line) => line.item === "Mayonnaise");
  assert.equal(mayo?.qty, 4280); // 400 g × 10.71, to the nearest 10 g

  // You can't order a fraction of a lemon.
  assert.equal(plan.orders.find((line) => line.item === "Lemons")?.qty, 33);
});

test("applies no yield multiplier — a recipe is already an ordering weight", () => {
  const plan = planEvent({
    ...BASE,
    guests: 10,
    recipes: [
      {
        name: "Brisket",
        serves: 10,
        ingredients: [
          { item: "Beef brisket", qty: 5, unit: "kg", category: "Meat/Seafood" },
        ],
      },
    ],
  });
  const line = plan.orders.find((o) => o.item === "Beef brisket");
  // 12 effective × 1.1 buffer = 13.2 ÷ 10 = 1.32 → 5 kg × 1.32 = 6.6
  assert.equal(line?.qty, 6.5);
});

test("the parts a dish is written in reach the bench sheet, unchanged", () => {
  const plan = planEvent({
    ...BASE,
    guests: 10,
    recipes: [
      {
        name: "Buttermilk chicken",
        serves: 10,
        ingredients: [
          { item: "Plain flour", qty: 500, unit: "g", category: "Dry goods", section: "Dry" },
          { item: "Buttermilk", qty: 2, unit: "L", category: "Dairy", section: "Wet" },
        ],
      },
    ],
  });

  const sheet = plan.dishSheets.find((d) => d.name === "Buttermilk chicken");
  assert.deepEqual(
    sheet?.ingredients.map((i) => i.section),
    ["Dry", "Wet"],
  );

  // The order sheet is shopped by supplier, not by part, so nothing there
  // changes — the same two lines, in the same categories.
  assert.equal(
    plan.orders.find((o) => o.item === "Plain flour")?.category,
    "Dry goods",
  );
});

test("warns when recipes and generic sides are both on the same job", () => {
  const plan = planEvent({ ...BASE, sidesCount: 3, recipes: [SLAW] });
  assert.ok(plan.warnings.some((w) => w.includes("ordering the same food twice")));
});

test("a recipe with no serves count is refused rather than guessed at", () => {
  assert.throws(
    () => planEvent({ ...BASE, recipes: [{ ...SLAW, serves: 0 }] }),
    /doesn't say how many it serves/,
  );
});

// -------------------------------------------------------------- conversions

test("converts imperial mass to metric, because nobody orders in pounds", () => {
  assert.deepEqual(parseIngredientLine("2 lb beef chuck"), {
    item: "beef chuck",
    qty: 0.91,
    unit: "kg",
    category: "Meat/Seafood",
  });
  assert.equal(parseIngredientLine("8 oz butter")?.qty, 227);
  assert.equal(parseIngredientLine("8 oz butter")?.unit, "g");
});

test("converts imperial volume, and leaves cups alone", () => {
  assert.equal(parseIngredientLine("8 fl oz cream")?.qty, 237);
  assert.equal(parseIngredientLine("8 fl oz cream")?.unit, "ml");
  // A cup of flour and a cup of oil are different weights, so converting
  // would mean guessing. It stays a cup.
  assert.equal(parseIngredientLine("2 cups flour")?.unit, "cup");
});

// ------------------------------------------------------------- web import

test("pulls a recipe out of schema.org JSON-LD", () => {
  const html = `<html><head><script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Recipe","name":"Braised Beef",
     "recipeYield":"Serves 6",
     "recipeIngredient":["2 lb beef chuck","1 &amp; onion","3 x 400g tinned tomatoes"]}
  </script></head><body></body></html>`;

  const recipe = extractRecipe(html);
  assert.equal(recipe?.name, "Braised Beef");
  assert.equal(recipe?.serves, 6);
  assert.equal(recipe?.servesAssumed, false);
  assert.equal(recipe?.ingredients.length, 3);
  assert.equal(recipe?.ingredients[0].unit, "kg");
});

test("finds a recipe nested in an @graph", () => {
  const html = `<script type="application/ld+json">
    {"@graph":[{"@type":"WebPage"},{"@type":["Recipe"],"name":"Slaw",
     "recipeIngredient":["1 kg cabbage"]}]}</script>`;
  assert.equal(extractRecipe(html)?.name, "Slaw");
});

test("says so rather than inventing a yield", () => {
  const html = `<script type="application/ld+json">
    {"@type":"Recipe","name":"Mystery","recipeIngredient":["1 kg fish"]}</script>`;
  const recipe = extractRecipe(html);
  assert.equal(recipe?.servesAssumed, true);
  assert.equal(recipe?.serves, 4);
});

test("a range yield takes the smaller number, so you cook enough", () => {
  assert.equal(parseYield("4-6 servings"), 4);
  assert.equal(parseYield(["8"]), 8);
  assert.equal(parseYield("a few"), null);
});

test("a yield measured in food is not a headcount", () => {
  // The one that got out. A pico de gallo published as "2 cups" was read as
  // serving two people, so a job for 19 scaled it ×11.55 and ordered 35
  // tomatoes. Two cups is what the bowl holds, not who eats it.
  assert.equal(parseYield("2 cups"), null);
  assert.equal(parseYield("2.5 cups"), null);
  assert.equal(parseYield("500 ml"), null);
  assert.equal(parseYield("1.5 kg"), null);
  assert.equal(parseYield("8 tbsp"), null);

  // The shape that would have slipped through a check on the first entry
  // alone: a bare number that turns out to be cups when you read on.
  assert.equal(parseYield(["2", "2 cups"]), null);
});

test("a countable yield still reads as a headcount", () => {
  // Rejecting volumes must not start rejecting the ordinary cases.
  assert.equal(parseYield("Serves 6"), 6);
  assert.equal(parseYield("makes 12"), 12);
  assert.equal(parseYield("12 muffins"), 12);
  assert.equal(parseYield(["8", "8 servings"]), 8);
  assert.equal(parseYield("4 people"), 4);
});

test("a volume yield makes the app ask rather than assume", () => {
  const html = `<script type="application/ld+json">
    {"@type":"Recipe","name":"Pico de Gallo","recipeYield":"2 cups",
     "recipeIngredient":["3 large tomatoes","1/4 cup finely chopped white onion"]}</script>`;
  const recipe = extractRecipe(html);
  assert.equal(recipe?.servesAssumed, true, "must be flagged, not trusted");
  assert.notEqual(recipe?.serves, 2, "two cups is not two people");
});

test("returns nothing when the page has no readable recipe", () => {
  assert.equal(extractRecipe("<html><body>just a blog</body></html>"), null);
  assert.equal(extractRecipe('<script type="application/ld+json">{bad json</script>'), null);
});

// ------------------------------------------- amount written after the item

test("reads the amount when it comes after the ingredient", () => {
  assert.deepEqual(parseIngredientLine("Bacon: 225g"), {
    item: "Bacon",
    qty: 225,
    unit: "g",
    category: "Meat/Seafood",
  });
  assert.deepEqual(parseIngredientLine("Chicken breast/thigh: 2kg"), {
    item: "Chicken breast/thigh",
    qty: 2,
    unit: "kg",
    category: "Meat/Seafood",
  });
  assert.equal(parseIngredientLine("Pork mince - 750 g")?.qty, 750);
});

test("a trailing word that isn't a unit stays part of the name", () => {
  // "Sourdough loaf" must not be read as 0 of some unit.
  const parsed = parseIngredientLine("Salt and pepper");
  assert.equal(parsed?.item, "Salt and pepper");
  assert.equal(parsed?.unit, "ea");
});

// ------------------------------------------------------------- bite size

test("bigger bites order more of the operator's recipes", () => {
  const standard = planEvent({ ...BASE, recipes: [SLAW] });
  const bigger = planEvent({ ...BASE, recipes: [SLAW], biteSize: "bigger" });
  const smaller = planEvent({ ...BASE, recipes: [SLAW], biteSize: "smaller" });

  const fennel = (p: ReturnType<typeof planEvent>) =>
    p.orders.find((o) => o.item === "Fennel")!.qty;

  assert.ok(bigger.orders.length > 0);
  assert.ok(fennel(bigger) > fennel(standard));
  assert.ok(fennel(smaller) < fennel(standard));
});

// --------------------------------------------------- no main, and totals

test("a menu of only recipes needs no protein ticked", () => {
  const plan = planEvent({ ...BASE, proteins: [], recipes: [SLAW] });
  assert.ok(!plan.orders.some((o) => o.forDish === "Main"));
  assert.equal(plan.servedPerProtein, 0);
});

test("with no recipes and no proteins it says what's missing", () => {
  assert.throws(
    () => planEvent({ ...BASE, proteins: [], recipes: [] }),
    /Add a dish from your recipes/,
  );
});

test("the same ingredient across dishes becomes one total", () => {
  const plan = planEvent({
    ...BASE,
    guests: 28,
    proteins: [],
    recipes: [
      {
        name: "Sausage rolls",
        serves: 30,
        ingredients: [{ item: "Bacon", qty: 225, unit: "g", category: "Meat/Seafood" }],
      },
      {
        name: "Mini quiche",
        serves: 30,
        ingredients: [{ item: "bacon", qty: 188, unit: "g", category: "Meat/Seafood" }],
      },
    ],
  });

  const bacon = plan.orders.filter((o) => o.item.toLowerCase() === "bacon");
  assert.equal(bacon.length, 1, "bacon should appear once, not once per dish");
  assert.equal(bacon[0].forDish, "Sausage rolls, Mini quiche");
  // 30 guests + 2 crew = 30 × 1.1 = 33 ÷ 30 = 1.1 → (225 + 188) × 1.1 = 454
  assert.equal(bacon[0].qty, 450);
  assert.match(bacon[0].basis, /2 dishes added together/);
});

test("units that can't be added together stay on separate lines", () => {
  const plan = planEvent({
    ...BASE,
    proteins: [],
    recipes: [
      {
        name: "A",
        serves: 100,
        ingredients: [{ item: "Parsley", qty: 2, unit: "bunches", category: "Produce" }],
      },
      {
        name: "B",
        serves: 100,
        ingredients: [{ item: "Parsley", qty: 50, unit: "g", category: "Produce" }],
      },
    ],
  });
  assert.equal(plan.orders.filter((o) => o.item === "Parsley").length, 2);
});
