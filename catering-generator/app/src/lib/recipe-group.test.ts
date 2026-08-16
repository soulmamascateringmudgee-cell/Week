import assert from "node:assert/strict";
import { test } from "node:test";

import { COURSE_CHOICES } from "./options.ts";
import { groupByCourse, normalise } from "./recipe-group.ts";
import type { RecipeChoice } from "./recipe-group.ts";

const dish = (
  name: string,
  course: string | null,
  serves = 10,
): RecipeChoice => ({ id: name, name, course, serves });

const BOOK: RecipeChoice[] = [
  dish("Slow-cooked brisket", "Main"),
  dish("Pulled pork", "Main"),
  dish("Fennel slaw", "Side"),
  dish("Chimichurri", "Sauce"),
  dish("Pavlova", "Dessert"),
  dish("Crème brûlée", "Dessert"),
  dish("Arancini", "Entrée"),
];

test("groups dishes under their course, in menu order", () => {
  const groups = groupByCourse(BOOK);
  assert.deepEqual(
    groups.map((g) => g.course),
    ["Entrée", "Main", "Side", "Sauce", "Dessert"],
  );
  assert.deepEqual(
    groups.find((g) => g.course === "Main")?.recipes.map((r) => r.name),
    ["Slow-cooked brisket", "Pulled pork"],
  );
});

test("drops courses with nothing in them", () => {
  const groups = groupByCourse([dish("Fennel slaw", "Side")]);
  assert.deepEqual(
    groups.map((g) => g.course),
    ["Side"],
  );
});

// The whole point of grouping is that a dish is easier to find. A dish that
// falls out of every group is worse than the flat list this replaced.
test("every dish lands in exactly one group, whatever its course says", () => {
  const odd: RecipeChoice[] = [
    ...BOOK,
    dish("Nan's trifle", null),
    dish("Cheese board", "Grazing table"),
    dish("Sourdough", ""),
    dish("Compound butter", "  Sauce  "),
  ];

  const groups = groupByCourse(odd);
  const placed = groups.flatMap((g) => g.recipes.map((r) => r.name));

  assert.equal(placed.length, odd.length);
  assert.deepEqual([...placed].sort(), odd.map((r) => r.name).sort());

  const other = groups.find((g) => g.course === "Other");
  assert.deepEqual(other?.recipes.map((r) => r.name), [
    "Nan's trifle",
    "Cheese board",
    "Sourdough",
  ]);
  // Padded but otherwise valid — trimmed, not exiled to Other.
  assert.ok(
    groups
      .find((g) => g.course === "Sauce")
      ?.recipes.some((r) => r.name === "Compound butter"),
  );
});

test("search matches part of a name, ignoring case", () => {
  const groups = groupByCourse(BOOK, "PORK");
  assert.deepEqual(
    groups.flatMap((g) => g.recipes.map((r) => r.name)),
    ["Pulled pork"],
  );
});

test("search ignores accents in both directions", () => {
  assert.deepEqual(
    groupByCourse(BOOK, "creme").flatMap((g) => g.recipes.map((r) => r.name)),
    ["Crème brûlée"],
  );
  assert.deepEqual(
    groupByCourse([dish("Creme caramel", "Dessert")], "crème").flatMap((g) =>
      g.recipes.map((r) => r.name),
    ),
    ["Creme caramel"],
  );
});

test("a search with no hits returns nothing rather than everything", () => {
  assert.deepEqual(groupByCourse(BOOK, "lasagne"), []);
});

test("whitespace-only search is treated as no search", () => {
  assert.equal(
    groupByCourse(BOOK, "   ").flatMap((g) => g.recipes).length,
    BOOK.length,
  );
});

test("normalise collapses runs of whitespace", () => {
  assert.equal(normalise("  Slow   cooked  BRISKET "), "slow cooked brisket");
});

test("Other is a real course on the recipe form, so it can be chosen", () => {
  assert.ok(COURSE_CHOICES.includes("Other"));
});
