import assert from "node:assert/strict";
import { test } from "node:test";

import { parseIngredients } from "./recipe-parse.ts";
import {
  groupBySection,
  hasSections,
  sectionChoices,
  sectionHeading,
  tidySection,
} from "./recipe-sections.ts";

// ------------------------------------------------------------------ tidying

test("a section is trimmed, collapsed, and stripped of its colon", () => {
  assert.equal(tidySection("  Dry  ingredients :"), "Dry ingredients");
  assert.equal(tidySection("Wet:"), "Wet");
  assert.equal(tidySection("For the marinade"), "For the marinade");
});

test("blank, missing and non-text sections all mean no section", () => {
  assert.equal(tidySection(""), null);
  assert.equal(tidySection("   "), null);
  assert.equal(tidySection(":"), null);
  assert.equal(tidySection(undefined), null);
  assert.equal(tidySection(null), null);
  assert.equal(tidySection(42), null);
});

// ----------------------------------------------------------------- grouping

const line = (item: string, section?: string) => ({
  item,
  qty: 1,
  unit: "kg",
  ...(section === undefined ? {} : { section }),
});

test("groups a dish into its parts, in the order they were written", () => {
  const groups = groupBySection([
    line("Flour", "Dry"),
    line("Baking powder", "Dry"),
    line("Buttermilk", "Wet"),
    line("Eggs", "Wet"),
  ]);

  assert.deepEqual(
    groups.map((g) => g.heading),
    ["Dry", "Wet"],
  );
  assert.deepEqual(
    groups[0].ingredients.map((i) => i.item),
    ["Flour", "Baking powder"],
  );
});

test("the same part written two ways is one part, not two", () => {
  const groups = groupBySection([
    line("Flour", "Dry"),
    line("Salt", "dry:"),
    line("Sugar", " DRY "),
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].ingredients.length, 3);
  // The first spelling wins the heading — the cook's own first choice.
  assert.equal(groups[0].heading, "Dry");
});

test("a part written twice, apart, collects in one place", () => {
  const groups = groupBySection([
    line("Flour", "Dry"),
    line("Buttermilk", "Wet"),
    line("Salt", "Dry"),
  ]);

  assert.deepEqual(
    groups.map((g) => g.heading),
    ["Dry", "Wet"],
  );
  assert.deepEqual(
    groups[0].ingredients.map((i) => i.item),
    ["Flour", "Salt"],
  );
});

test("lines with no part lead, under a plain heading", () => {
  const groups = groupBySection([
    line("Flour", "Dry"),
    line("Brisket"),
    line("Buttermilk", "Wet"),
  ]);

  assert.deepEqual(
    groups.map((g) => g.heading),
    ["Ingredients", "Dry", "Wet"],
  );
  assert.equal(groups[0].section, null);
});

test("every ingredient survives the grouping", () => {
  const dish = [
    line("Flour", "Dry"),
    line("Brisket"),
    line("Buttermilk", "Wet"),
    line("Salt", "Dry"),
    line("Oil"),
  ];
  const grouped = groupBySection(dish).flatMap((g) => g.ingredients);
  assert.equal(grouped.length, dish.length);
  assert.deepEqual(new Set(grouped.map((i) => i.item)), new Set(dish.map((i) => i.item)));
});

test("a dish that is one list has no parts to show", () => {
  assert.equal(hasSections([line("Brisket"), line("Salt")]), false);
  assert.equal(hasSections([line("Flour", "Dry"), line("Salt", "Dry")]), false);
  assert.equal(hasSections([line("Flour", "Dry"), line("Milk", "Wet")]), true);
  // A dish part-way through being organised has two parts: the named one and
  // the rest, which is exactly when a cook needs the headings.
  assert.equal(hasSections([line("Flour", "Dry"), line("Salt")]), true);
});

test("the cook's own parts are offered before the stock suggestions", () => {
  const choices = sectionChoices([line("Panko", "For the crumb"), line("Salt")]);
  assert.equal(choices[0], "For the crumb");
  assert.ok(choices.includes("Wet"));
  // No duplicate when the cook has used one of the suggested names already.
  const dry = sectionChoices([line("Flour", "dry")]);
  assert.equal(dry.filter((c) => c.toLowerCase() === "dry").length, 1);
});

// ----------------------------------------------------------------- headings

test("reads the shapes a heading is actually written in", () => {
  assert.equal(sectionHeading("For the marinade"), "For the marinade");
  assert.equal(sectionHeading("For the marinade:"), "For the marinade");
  assert.equal(sectionHeading("Dry ingredients:"), "Dry");
  assert.equal(sectionHeading("Wet ingredients"), "Wet");
  assert.equal(sectionHeading("Topping:"), "Topping");
  assert.equal(sectionHeading("- Sauce:"), "Sauce");
  assert.equal(sectionHeading("DRY"), "DRY");
});

test("a heading that is only the word ingredients keeps it", () => {
  assert.equal(sectionHeading("Ingredients:"), "Ingredients");
});

/*
 * The failure that matters. A heading mistaken for an ingredient leaves a junk
 * line the cook can see and delete; an ingredient mistaken for a heading drops
 * food off the order sheet silently, which is how a wedding runs out of
 * something. So these all have to stay ingredients.
 */
test("an ingredient is never mistaken for a heading", () => {
  assert.equal(sectionHeading("Salt and pepper"), null);
  assert.equal(sectionHeading("Bacon: 225g"), null);
  assert.equal(sectionHeading("5 kg beef brisket"), null);
  assert.equal(sectionHeading("½ cup olive oil"), null);
  assert.equal(sectionHeading("Fennel"), null);
  assert.equal(sectionHeading("Lemons, juiced"), null);
  assert.equal(sectionHeading(""), null);
  assert.equal(
    sectionHeading(
      "Season the brisket the night before and leave it uncovered in the fridge:",
    ),
    null,
  );
});

// ------------------------------------------------------- pasting a recipe in

test("a pasted recipe keeps its headings and files the lines under them", () => {
  const rows = parseIngredients(
    [
      "Dry ingredients:",
      "500 g plain flour",
      "2 tsp baking powder",
      "",
      "Wet ingredients:",
      "600 ml buttermilk",
      "3 eggs",
    ].join("\n"),
  );

  assert.equal(rows.length, 4);
  assert.deepEqual(
    rows.map((r) => r.section),
    ["Dry", "Dry", "Wet", "Wet"],
  );
  assert.equal(rows[0].item, "plain flour");
});

test("a heading is not pasted in as an ingredient", () => {
  const rows = parseIngredients("For the marinade\n2 kg chicken thigh");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].item, "chicken thigh");
  assert.equal(rows[0].section, "For the marinade");
});

test("lines above the first heading keep no section", () => {
  const rows = parseIngredients("5 kg brisket\nFor the sauce:\n200 ml vinegar");
  assert.equal(rows[0].section, undefined);
  assert.equal(rows[1].section, "For the sauce");
});
