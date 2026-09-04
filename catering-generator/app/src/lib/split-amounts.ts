/**
 * One amount on the sheet, two pots at the bench.
 *
 * A sticky date pudding whose method creams brown sugar into the batter and
 * then makes a butterscotch sauce out of brown sugar as well, over an
 * ingredient list holding one line: brown sugar, 600 g. At a nineteen-guest
 * job that line prints as 1390 g, which is the right total and the wrong
 * instruction. A cook creaming butter and sugar tips in 1390 g, and there is
 * nothing left for the sauce.
 *
 * The sheet is not lying — 1390 g is genuinely what the dish needs. It just
 * answers a question nobody asked. What the cook needs at the bench is how
 * much goes in each pot, and the recipe never said.
 *
 * The app cannot work out the split. Nothing in the record says whether the
 * sauce takes half the sugar or a fifth, and inventing a ratio would be the
 * one thing this whole app exists not to do — a guess printed in the same
 * type as a measurement. What it can do is notice, and say so, and point at
 * the fix, which already exists: the ingredient list can be written in parts,
 * and a list written in parts prints its headings straight onto the sheet.
 *
 * So the test is deliberately structural rather than clever:
 *
 *   The method names a separate preparation — a sauce, a dressing, a marinade
 *   — under its own heading, and the ingredient list has no parts at all.
 *
 * Both halves are read off the record with no inference. A dish with a
 * BUTTERSCOTCH SAUCE heading is a dish with two pots in it; a flat ingredient
 * list is a list that cannot say which pot. That pair is the whole finding.
 */

import { groupBySection } from "./recipe-sections.ts";
import type { Recipe } from "./types.ts";

/**
 * Headings that mean "this is a second thing you make", and only these.
 *
 * A method's shouted headings are mostly stage directions — PREP, MAKE AHEAD,
 * TO SERVE, DIETARY, GLUTEN FREE — and none of them is another pot. The words
 * below are the ones that name a preparation with its own ingredients, which
 * is the only case where a single amount has to be divided before it can be
 * used.
 */
const SEPARATE_PREPARATIONS = [
  "sauce",
  "dressing",
  "marinade",
  "glaze",
  "topping",
  "crumble",
  "crumb",
  "filling",
  "salsa",
  "pickle",
  "syrup",
  "caramel",
  "custard",
  "icing",
  "frosting",
  "ganache",
  "slaw",
  "aioli",
  "mayo",
  "pesto",
  "relish",
  "chutney",
  "compote",
  "coulis",
  "batter",
  "dough",
  "rub",
  "brine",
  "dust",
] as const;

/**
 * A shouted heading at the front of what's left of a line: capitals, no lower
 * case, no colon of its own, ending in a colon.
 *
 * Anchored and stripped in a loop rather than searched for, because these
 * nest. "PREP: SALSA VERDE: finely chop parsley" is one line carrying two
 * headings, and a single greedy match reads it as one heading called "PREP:
 * SALSA VERDE" — which names a sauce only by accident, and would print back
 * to the cook as a phrase they never wrote.
 */
const HEADING = /^\s*([^a-z\n:]{2,60}):/;

/**
 * The separate preparations this method makes, by the name it calls them.
 *
 * "BUTTERSCOTCH SAUCE" rather than "sauce", because the cook wrote it and it
 * is what they will be looking for on the page.
 */
export function separatePreparations(method: string | null | undefined): string[] {
  if (typeof method !== "string" || method.trim() === "") return [];

  const found: string[] = [];
  const seen = new Set<string>();

  for (const line of method.split("\n")) {
    let rest = line;
    let match = HEADING.exec(rest);
    while (match) {
      const heading = match[1].replace(/\s+/g, " ").trim();
      rest = rest.slice(match[0].length);
      match = HEADING.exec(rest);

      // Digits and dashes pass the character class — "180C", "10-12 MIN" — so
      // a heading has to actually be words.
      if (!/[A-Z]{2}/.test(heading)) continue;

      const words = heading.toLowerCase();
      const names = SEPARATE_PREPARATIONS.some((word) =>
        new RegExp(`\\b${word}s?\\b`).test(words),
      );
      if (!names || seen.has(words)) continue;
      seen.add(words);
      found.push(heading);
    }
  }
  return found;
}

/**
 * The separate preparations whose amounts the sheet can't split, which is the
 * pair of facts the whole finding rests on: the method makes something apart
 * from the dish, and the ingredient list gives one undivided column.
 *
 * Empty in the two cases that matter. A dish with no separate preparation has
 * one pot, so its totals *are* the instruction. A dish already written in
 * parts prints its headings and its split straight onto the sheet, and has
 * nothing left to be told.
 */
function unsplitPreparations(recipe: Recipe): string[] {
  const ingredients = recipe.ingredients ?? [];
  if (ingredients.length === 0) return [];
  if (groupBySection(ingredients).length > 1) return [];
  return separatePreparations(recipe.method);
}

/** Names in a list, as a person would say them. */
function andList(names: string[]): string {
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * What to tell the cook, or null when the sheet already reads correctly.
 *
 * Null in the two cases that matter: a dish with no separate preparation in
 * it, where every amount belongs to one pot and the total is the instruction;
 * and a dish whose ingredient list is already written in parts, where the
 * sheet prints the split and there is nothing left to say.
 *
 * It does not name which ingredients are shared, and that restraint is the
 * point. Reading that off the prose means matching ingredient names against a
 * method where "cream" is a verb before it is a thing — and an alarm about
 * brown sugar that is wrong once is an alarm nobody reads the third time. The
 * heading is certain; the attribution is not. So it says the certain thing and
 * hands the cook the page where the uncertain one gets settled by the only
 * person who knows it.
 */
export function splitAmountWarning(recipe: Recipe): string | null {
  const parts = unsplitPreparations(recipe);
  if (parts.length === 0) return null;

  const one = parts.length === 1;
  const named = andList(parts.map((part) => part.toLowerCase()));
  const shared = one
    ? `Anything used in both the ${parts[0].toLowerCase()} and the rest of the dish`
    : `Anything used in more than one of them`;

  return (
    `${recipe.name}: the method makes ${one ? "a separate" : "separate"} ` +
    `${named}, but the ingredient list isn't split into parts — so every ` +
    `amount on the sheet is the total for the whole dish, not the amount for ` +
    `one pot. ${shared} has to be divided at the bench, and the recipe ` +
    `doesn't say how. Give each line a Part on the Recipes page and the sheet ` +
    `will print the split.`
  );
}

/**
 * The same finding, short, to sit on the dish's own sheet.
 *
 * The warnings list is read once, at the top of a long page, the day the job
 * is planned. This sheet is read at the bench with a bowl in the way, and the
 * number it is read next to — 1390 g of brown sugar — is the one that misleads
 * if nothing beside it says what it counts. A caution belongs where the
 * mistake gets made, so it is in both places and worded for each.
 */
export function splitAmountNote(recipe: Recipe): string | null {
  const parts = unsplitPreparations(recipe);
  if (parts.length === 0) return null;

  const named = andList(parts.map((part) => part.toLowerCase()));
  return (
    `These are totals for the whole dish. The ${named} ` +
    `${parts.length === 1 ? "is made" : "are made"} separately, and this list ` +
    `isn't split into parts — so anything used in both has to be divided here ` +
    `at the bench. The recipe doesn't say how much goes where.`
  );
}
