import assert from "node:assert/strict";
import { test } from "node:test";

import {
  separatePreparations,
  splitAmountNote,
  splitAmountWarning,
} from "./split-amounts.ts";
import type { Recipe, RecipeIngredient } from "./types.ts";

function ingredient(item: string, section?: string): RecipeIngredient {
  return {
    item,
    qty: 1,
    unit: "ea",
    category: "Dry goods",
    ...(section ? { section } : {}),
  };
}

function recipe(over: Partial<Recipe> & Pick<Recipe, "name">): Recipe {
  return {
    serves: 10,
    course: "Main",
    method: "",
    notes: "",
    ingredients: [ingredient("Brown sugar"), ingredient("Butter")],
    ...over,
  } as Recipe;
}

// --- The one that printed ----------------------------------------------------

test("the sticky date pudding's two pots of brown sugar are caught", () => {
  // Verbatim shape of the recipe that printed 1390 g of brown sugar as one
  // line: creamed into the batter, and again in a sauce made separately.
  const said = splitAmountWarning(
    recipe({
      name: "Gluten free sticky date pudding",
      method:
        "PREP: Chop the dates.\n\nCream butter and brown sugar until pale.\n\n" +
        "BUTTERSCOTCH SAUCE: brown sugar, butter and cream in a pan, stir over " +
        "medium heat until the sugar dissolves.\n\nMAKE AHEAD: better the next day.",
    }),
  );

  assert.ok(said);
  assert.match(said, /Gluten free sticky date pudding/);
  assert.match(said, /butterscotch sauce/);
  assert.match(said, /total for the whole dish/);
  assert.match(said, /Recipes page/);
});

test("the heading is quoted as the cook wrote it, not as a category", () => {
  assert.deepEqual(
    separatePreparations("BUTTERSCOTCH SAUCE: sugar, butter and cream."),
    ["BUTTERSCOTCH SAUCE"],
  );
  assert.deepEqual(separatePreparations("DRESSING: whisk it."), ["DRESSING"]);
});

test("headings that nest on one line are read as two", () => {
  // "PREP: SALSA VERDE: finely chop parsley" is one line carrying two
  // headings. Read greedily it becomes a preparation called "PREP: SALSA
  // VERDE" — a phrase the cook never wrote, printed back at them as if they had.
  assert.deepEqual(
    separatePreparations("PREP: SALSA VERDE: finely chop parsley and capers."),
    ["SALSA VERDE"],
  );
});

// --- Not crying wolf ---------------------------------------------------------

test("stage directions are not preparations", () => {
  // Every method in the book shouts these, and not one of them is a second pot.
  assert.deepEqual(
    separatePreparations(
      "PREP: chop it.\nGLUTEN FREE: check the label.\nMAKE AHEAD: better " +
        "tomorrow.\nTO SERVE: warm through.\nDIETARY: not vegan.",
    ),
    [],
  );
});

test("a dish with one pot says nothing", () => {
  assert.equal(
    splitAmountWarning(
      recipe({
        name: "Roast potatoes",
        method: "Heat oven 200C. Roast 40 min, turning once.",
      }),
    ),
    null,
  );
});

test("a list already written in parts says nothing", () => {
  // The sheet prints the headings and the split, so there is nothing to tell.
  assert.equal(
    splitAmountWarning(
      recipe({
        name: "Rainbow crunch slaw",
        method: "Shred it all.\n\nDRESSING: whisk oil, lemon and honey.",
        ingredients: [
          ingredient("Red cabbage", "Slaw"),
          ingredient("Olive oil", "Dressing"),
          ingredient("Lemon", "Dressing"),
        ],
      }),
    ),
    null,
  );
});

test("a temperature is not a heading", () => {
  // "180C:" and "10-12 MIN:" pass a no-lower-case test on letters alone.
  assert.deepEqual(separatePreparations("180C: bake until golden."), []);
});

test("a recipe with no ingredients says nothing", () => {
  assert.equal(
    splitAmountWarning(
      recipe({ name: "Empty", method: "SAUCE: make it.", ingredients: [] }),
    ),
    null,
  );
});

// --- What it says ------------------------------------------------------------

test("two separate preparations read as two", () => {
  const said = splitAmountWarning(
    recipe({
      name: "Roast veg",
      method: "Roast it.\n\nTAHINI SAUCE: whisk.\n\nHERB DRESSING: blitz.",
    }),
  );
  assert.ok(said);
  assert.match(said, /tahini sauce and herb dressing/);
  assert.match(said, /more than one of them/);
});

test("the sheet's own note is short and points at the bench", () => {
  const note = splitAmountNote(
    recipe({
      name: "Gluten free sticky date pudding",
      method: "Cream the butter.\n\nBUTTERSCOTCH SAUCE: sugar, butter, cream.",
    }),
  );
  assert.ok(note);
  // No dish name: it sits under the dish's own heading on its own sheet.
  assert.doesNotMatch(note, /Gluten free sticky date pudding/);
  assert.match(note, /totals for the whole dish/);
  assert.match(note, /doesn't say how much goes where/);
});

test("the note and the warning agree about when to appear", () => {
  const quiet = recipe({ name: "Plain", method: "Just cook it." });
  assert.equal(splitAmountWarning(quiet), null);
  assert.equal(splitAmountNote(quiet), null);

  const loud = recipe({ name: "Sauced", method: "Cook.\n\nSAUCE: whisk it." });
  assert.ok(splitAmountWarning(loud));
  assert.ok(splitAmountNote(loud));
});
