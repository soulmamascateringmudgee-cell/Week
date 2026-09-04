/**
 * Food the method calls for that the ingredient list never mentions.
 *
 * A sticky date pudding whose method says "check your baking powder is gluten
 * free" and whose ingredient list has no baking powder. Chicken sliders whose
 * method says "bun → sauce → lettuce → chicken" over an ingredient list with
 * neither chicken nor buns. Both really happened, both printed, and neither
 * said a word — the order sheet is faithful to the recipe, and the recipe is
 * the thing that's wrong.
 *
 * This is the worst shape a failure can take here. A wrong number is at least
 * visible; a missing one leaves nothing on the page to notice. You find out at
 * six in the morning with the oven on, or in the van with no chicken.
 *
 * The method is sitting in the same record as the ingredients, so it costs
 * nothing to read one against the other. Two checks, both deliberately narrow:
 *
 *   **Named in the method.** Only from a short list of things whose amount
 *   actually matters — leaveners, the structure of a bake, a protein, what a
 *   burger is served in. Not salt, not pepper, not water: "a pinch of salt at
 *   the end" is in half the methods ever written and belongs to nobody's
 *   shopping list.
 *
 *   **Named in the dish.** A dish called chicken sliders should contain
 *   chicken. That one check would have caught the sliders on its own.
 *
 * The bar is high on purpose. A warning that cries wolf on ordinary recipes is
 * one nobody reads by the time it matters.
 */

import type { Recipe } from "./types.ts";

/**
 * Words worth checking for, and only these.
 *
 * Every entry is something where going without it is a real problem: the bake
 * doesn't rise, the protein isn't bought, the burger has nothing to sit in.
 * Deliberately absent are the store-cupboard things a method mentions in
 * passing and nobody orders by the gram — salt, pepper, water, seasoning.
 */
const WORTH_CHECKING = [
  // Leaveners. A pudding without its raising agent is a brick, and the amount
  // is not something you can eyeball at the bench.
  "baking powder",
  "baking soda",
  "bicarb soda",
  "bicarbonate of soda",
  "bicarb",
  "yeast",
  "cream of tartar",
  "gelatine",

  // The structure of a bake.
  //
  // Butter, cream and flour are deliberately absent, and it costs real
  // coverage to leave them out. All three are verbs in method prose — "cream
  // the butter and sugar", "butter the tin", "flour the bench" — so a recipe
  // with butter and sugar but no cream would be told it was missing cream,
  // every time, on a step that is only ever about beating. That is the
  // cry-wolf failure, and one false alarm a week is enough to make a cook stop
  // reading the true ones. Their absence is also the kind a baker notices:
  // nobody creams a cake and fails to spot there is no butter. The things kept
  // below are the ones whose absence is silent.
  "egg",
  "sugar",
  "milk",
  "buttermilk",
  "vanilla",

  // Proteins. The single most expensive thing to arrive without.
  "chicken",
  "beef",
  "brisket",
  "pork",
  "lamb",
  "fish",
  "salmon",
  "prawn",
  "haloumi",
  "tofu",

  // What it's served in or on.
  //
  // "Roll" and "wrap" are left out for the same reason butter and cream are:
  // both are verbs before they are things. "Roll into balls", "roll out the
  // pastry", "cool and wrap" appear in a third of these recipes, and every one
  // of them would raise an alarm about a bread roll nobody wanted. Checked
  // against the real book, they were the whole of the noise.
  "bun",
  "bread",
  "baguette",
  "tortilla",
  "pastry",
  "rice",
  "pasta",
  "noodle",
] as const;

/**
 * Reduce a word to something that matches its plural.
 *
 * Buns and bun, eggs and egg, tomatoes and tomato. Crude on purpose: this only
 * has to be consistent between the two sides being compared, not correct
 * English.
 */
function stem(word: string): string {
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (/(oes|hes|ses|xes|zes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss") && word.length > 2) {
    return word.slice(0, -1);
  }
  return word;
}

/** Text as a space-padded run of stemmed words, ready for whole-word search. */
function stemmed(text: string): string {
  const words = text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean)
    .map(stem);
  return ` ${words.join(" ")} `;
}

/** True when `haystack` contains every word of `key`, in order. */
function mentions(haystack: string, key: string): boolean {
  return haystack.includes(` ${stemmed(key).trim()} `);
}

/**
 * Things the dish or its method calls for that aren't in the ingredient list.
 *
 * Returns the plain names, in the order they're worth mentioning, or an empty
 * array when the recipe accounts for itself.
 */
export function namedButNotListed(recipe: Recipe): string[] {
  const listed = stemmed(recipe.ingredients.map((i) => i.item).join(" "));
  // The dish name counts as a claim about what's in it, so it's searched
  // alongside the method.
  const claimed = stemmed(`${recipe.name ?? ""} ${recipe.method ?? ""}`);

  const missing: string[] = [];
  for (const key of WORTH_CHECKING) {
    if (!mentions(claimed, key)) continue;
    if (mentions(listed, key)) continue;
    // "bicarb soda" and "bicarb" are the same omission reported twice; the
    // longer name is already in, so skip anything contained by what's there.
    if (missing.some((found) => found.includes(key) || key.includes(found))) {
      continue;
    }
    missing.push(key);
  }
  return missing;
}

/** Names in a list, as a person would say them. */
function andList(names: string[]): string {
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * What to tell the cook, or null when there's nothing to tell.
 *
 * Says what's missing, says what it means — that none of it reached the order
 * sheet — and says what to do. It doesn't guess an amount: the whole point is
 * that nobody knows how much, which is exactly why it has to be asked rather
 * than assumed.
 *
 * It ends by giving the cook permission to ignore it, which is not hedging.
 * A method can name food that genuinely isn't an ingredient of this dish —
 * "before any tongs touch the lamb or chicken" on a fish recipe is about
 * another pan entirely — and nothing readable from the words can tell that
 * from a real omission. Saying so is honest, and it costs less than a warning
 * that insists on being obeyed when it's wrong.
 */
export function missingIngredientWarning(recipe: Recipe): string | null {
  const missing = namedButNotListed(recipe);
  if (missing.length === 0) return null;

  const one = missing.length === 1;
  return (
    `${recipe.name}: the method calls for ${andList(missing)}, but ${one ? "it isn't" : "they aren't"} ` +
    `in the ingredients — so ${one ? "it isn't" : "they aren't"} on the order sheet either. ` +
    `Add ${one ? "it" : "them"} to the recipe with an amount, or ignore this if the method ` +
    `only mentions ${one ? "it" : "them"} in passing.`
  );
}
