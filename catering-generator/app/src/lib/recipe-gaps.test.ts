import assert from "node:assert/strict";
import { test } from "node:test";

import { missingIngredientWarning, namedButNotListed } from "./recipe-gaps.ts";
import type { Recipe, RecipeIngredient } from "./types.ts";

function ingredient(item: string): RecipeIngredient {
  return { item, qty: 1, unit: "ea", category: "Dry goods" };
}

function recipe(over: Partial<Recipe> & Pick<Recipe, "name">): Recipe {
  return {
    serves: 10,
    course: "Main",
    method: "",
    notes: "",
    ingredients: [],
    ...over,
  } as Recipe;
}

// --- The two that actually got printed ---------------------------------------

test("the sticky date pudding's missing leaveners are caught", () => {
  // Verbatim from the recipe that printed: six ingredients, and a method that
  // names three things none of them are.
  const found = namedButNotListed(
    recipe({
      name: "Gluten free sticky date pudding",
      method:
        "PREP: Chop the dates. Cover with boiling water, stir in a pinch of bicarb soda, " +
        "leave 15 min until soft. GLUTEN FREE: use gluten free self raising flour and check " +
        "your baking powder and bicarb are marked gluten free. Beat the eggs in one at a " +
        "time with the vanilla. A pinch of salt at the end.",
      ingredients: [
        "Dates (pitted)",
        "Gluten free self-raising flour",
        "Brown sugar",
        "Butter",
        "Eggs",
        "Thickened cream",
      ].map(ingredient),
    }),
  );

  assert.ok(found.includes("baking powder"), "baking powder is missing");
  assert.ok(
    found.some((f) => f.startsWith("bicarb")),
    "bicarb is missing",
  );
  assert.ok(found.includes("vanilla"), "vanilla is missing");
});

test("the chicken sliders had no chicken and no buns", () => {
  const found = namedButNotListed(
    recipe({
      name: "Southern fried chicken sliders",
      method:
        "1. Marinate chicken 4+ hrs. 2. Dredge. 3. Rest, fry 165-175C. " +
        "4. Build: bun → chipotle sauce → lettuce → chicken → tomato → top bun.",
      ingredients: [
        "buttermilk",
        "smoked paprika",
        "plain flour",
        "cornflour",
        "Chipotle sauce",
        "Shredded lettuce",
        "slices of cheese",
      ].map(ingredient),
    }),
  );

  assert.deepEqual(found, ["chicken", "bun"]);
});

test("the dish name alone is enough to catch it", () => {
  // Even with no method at all, a dish called chicken sliders should have
  // chicken in it. This check would have caught the sliders on its own.
  const found = namedButNotListed(
    recipe({
      name: "Southern fried chicken sliders",
      method: "",
      ingredients: [ingredient("plain flour"), ingredient("buttermilk")],
    }),
  );
  assert.deepEqual(found, ["chicken"]);
});

// --- Not crying wolf ---------------------------------------------------------

test("a recipe that accounts for itself says nothing", () => {
  assert.deepEqual(
    namedButNotListed(
      recipe({
        name: "Chicken burgers",
        method: "Fry the chicken. Toast the buns. Butter them.",
        ingredients: [
          ingredient("Chicken thigh"),
          ingredient("Brioche buns"),
          ingredient("Butter"),
        ],
      }),
    ),
    [],
  );
  assert.equal(
    missingIngredientWarning(
      recipe({
        name: "Chicken burgers",
        method: "Fry the chicken. Toast the buns.",
        ingredients: [ingredient("Chicken thigh"), ingredient("Brioche buns")],
      }),
    ),
    null,
  );
});

test("plurals match their singulars, both ways round", () => {
  assert.deepEqual(
    namedButNotListed(
      recipe({
        name: "Egg salad rolls",
        // Plural in the method, singular in the list, and the other way round.
        method: "Boil the eggs. Split the rolls.",
        ingredients: [ingredient("Egg"), ingredient("Bread rolls")],
      }),
    ),
    [],
  );
});

test("rolling and wrapping are things you do, not things you buy", () => {
  // Checked against the real recipe book, these two were the whole of the
  // noise: "roll into balls", "roll out the pastry", "cool and wrap" fired an
  // alarm about a bread roll on a third of the dishes.
  assert.deepEqual(
    namedButNotListed(
      recipe({
        name: "Bliss balls",
        method: "Roll into balls. Roll them in coconut. Cool, then wrap and chill.",
        ingredients: [ingredient("Dates"), ingredient("Almonds")],
      }),
    ),
    [],
  );
});

test("a word used as a verb doesn't invent a missing ingredient", () => {
  // "Cream the butter and sugar" is a step about beating, not an instruction
  // to buy cream. Flagging it would put a false alarm on half the bakes in the
  // book, and a warning that cries wolf is one nobody reads by the time it
  // matters. Same for buttering a tin and flouring a bench.
  assert.deepEqual(
    namedButNotListed(
      recipe({
        name: "Sponge",
        method: "Cream the butter and sugar. Butter the tin. Flour the bench.",
        ingredients: [ingredient("Butter"), ingredient("Caster sugar")],
      }),
    ),
    [],
  );
});

test("the store cupboard is left alone", () => {
  // "A pinch of salt", "season with pepper", "boiling water" and "oil for
  // frying" are in half the methods ever written. Firing on them is how a
  // warning becomes wallpaper.
  assert.deepEqual(
    namedButNotListed(
      recipe({
        name: "Roast potatoes",
        method:
          "Season with salt and pepper, cover with boiling water, heat the oil.",
        ingredients: [ingredient("Potatoes")],
      }),
    ),
    [],
  );
});

test("a word inside another word doesn't count", () => {
  // "Buttermilk" is not butter and not milk. Reporting either would send a
  // cook looking for something the recipe never wanted.
  const found = namedButNotListed(
    recipe({
      name: "Pancakes",
      method: "Whisk the buttermilk through.",
      ingredients: [ingredient("Buttermilk"), ingredient("Plain flour")],
    }),
  );
  assert.deepEqual(found, []);
});

test("the same omission isn't reported twice under two names", () => {
  const found = namedButNotListed(
    recipe({
      name: "Scones",
      method: "Add the bicarb soda and the bicarb.",
      ingredients: [ingredient("Plain flour")],
    }),
  );
  assert.equal(found.length, 1, `reported: ${found.join(", ")}`);
});

// --- What it says ------------------------------------------------------------

test("the warning names the dish, the gap, and what it means", () => {
  const said = missingIngredientWarning(
    recipe({
      name: "Southern fried chicken sliders",
      method: "Build: bun → lettuce → chicken.",
      ingredients: [ingredient("Shredded lettuce")],
    }),
  );
  assert.ok(said);
  assert.match(said, /Southern fried chicken sliders/);
  assert.match(said, /chicken and bun/);
  assert.match(said, /order sheet/);
  assert.match(said, /Add them to the recipe/);
});

test("one missing thing reads as one thing", () => {
  const said = missingIngredientWarning(
    recipe({
      name: "Sticky date pudding",
      method: "Check your baking powder is gluten free.",
      ingredients: [ingredient("Dates"), ingredient("Plain flour")],
    }),
  );
  assert.ok(said);
  assert.match(said, /calls for baking powder, but it isn't/);
});
