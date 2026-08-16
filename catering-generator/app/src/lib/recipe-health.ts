/**
 * Catches recipes that cannot be scaled.
 *
 * A recipe earns its keep by having a number in the amount column. When an
 * import goes wrong the amount ends up inside the ingredient name instead —
 * "Bacon: 225g" sitting on a row that says 1 ea — and every line is silently
 * multiplied as though it were one of something. Scale that to 32 guests and
 * the sheet cheerfully asks for 2 ea of bacon.
 *
 * Nothing downstream can tell the difference, so it has to be caught here and
 * said out loud rather than quietly ordered.
 */

import type { Recipe } from "./types.ts";

/** "Bacon: 225g", "Panko: 60g (~1 1/8 cup)", "Egg: 2 (round up from 1.5)" */
const AMOUNT_IN_NAME =
  /\d\s*(?:g|kg|ml|l|tsp|tbsp|cup|cups|sheets?|cloves?|stalks?|punnet|bunch)\b|:\s*\d/i;

function looksPlaceholder(qty: number, unit: string): boolean {
  return qty === 1 && unit.toLowerCase() === "ea";
}

/**
 * True when most of a recipe's rows are a bare "1 ea" carrying their real
 * amount in the text. One such row is a judgement call — a whole recipe of
 * them is a broken import.
 */
export function hasUnscalableAmounts(recipe: Recipe): boolean {
  const lines = recipe.ingredients ?? [];
  if (lines.length < 3) return false;

  const suspect = lines.filter(
    (line) => looksPlaceholder(line.qty, line.unit) && AMOUNT_IN_NAME.test(line.item),
  ).length;

  return suspect / lines.length >= 0.5;
}

/** The warning an operator sees, naming the dish and what to do about it. */
export function unscalableWarning(recipe: Recipe): string {
  const example = (recipe.ingredients ?? []).find(
    (line) => looksPlaceholder(line.qty, line.unit) && AMOUNT_IN_NAME.test(line.item),
  );
  const quoted = example ? ` — "${example.item}" is sitting on a row that says 1 ea` : "";
  return (
    `"${recipe.name}" can't be scaled${quoted}. ` +
    `Its amounts are in the ingredient names instead of the amount column, so this job's numbers for it are wrong. ` +
    `Open the dish and put the amounts in the Amount and Unit columns, or paste the recipe in again.`
  );
}
