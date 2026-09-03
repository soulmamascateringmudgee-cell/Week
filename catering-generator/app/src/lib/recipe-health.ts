/**
 * Catches recipe lines that cannot be scaled.
 *
 * A recipe earns its keep by having a number in the amount column. When an
 * import goes wrong the amount ends up inside the ingredient name instead —
 * "1½ cups tomato sauce" sitting on a row that says 1 ea — and the line is
 * silently multiplied as though it were one of something. Scale that to 67
 * guests and the sheet cheerfully asks for 6 ea of tomato sauce.
 *
 * Nothing downstream can tell the difference, so it has to be caught here and
 * said out loud rather than quietly ordered.
 *
 * Two things this file gets wrong if you write it carelessly, both of which it
 * did get wrong and both of which shipped:
 *
 *   **Fractions are numbers.** A pattern anchored on an ASCII digit misses
 *   "½ cup" entirely, and misses "1½ cups" too, because the ½ sits between the
 *   digit and the unit. Recipes copied off the web are full of them, so the
 *   one shape that most needs catching was the one that sailed through.
 *
 *   **A part-broken recipe is the normal case, not the rare one.** Requiring
 *   most of a recipe's rows to be broken before saying anything assumed an
 *   import either works or doesn't. Real imports get twenty lines right and
 *   six wrong, and those six are more dangerous for it — the good lines make
 *   the sheet look trustworthy. One bad line is now worth a warning, and the
 *   warning names it.
 */

import type { Recipe } from "./types.ts";

/** Vulgar fractions, which appear in about every recipe copied off the web. */
const FRACTIONS = "¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞";

/**
 * An amount: "225", "1.5", "1/2", "½", or "1½" — a digit run, a fraction, or
 * a digit run followed by one.
 */
const NUMBER = `(?:[0-9]+(?:\\s*[./][0-9]+)?\\s*[${FRACTIONS}]?|[${FRACTIONS}])`;

/**
 * A unit. Anchored with a word boundary so "1 large onion" isn't read as one
 * litre, and "1/2 long cucumber" isn't read as anything at all.
 */
const UNIT =
  "(?:g|gram|grams|kg|kilo|kilos|kilogram|kilograms|ml|millilitre|millilitres|l|litre|litres|liter|liters|tsp|teaspoon|teaspoons|tbsp|tablespoon|tablespoons|cup|cups|sheets?|cloves?|stalks?|punnets?|bunch(?:es)?)";

/** "1½ cups tomato sauce", "Bacon: 225g", "Panko: 60g (~1 1/8 cup)" */
const AMOUNT_IN_NAME = new RegExp(`${NUMBER}\\s*${UNIT}\\b|:\\s*[0-9]`, "i");

function looksPlaceholder(qty: number, unit: string): boolean {
  return qty === 1 && unit.trim().toLowerCase() === "ea";
}

/**
 * The ingredient names on this recipe whose real amount is stuck in the name.
 *
 * A line only counts when it is *both* a bare "1 ea" *and* carries an amount
 * with a unit in its text. "Slice cheese — 1 ea" is not broken, it is one
 * slice of cheese per burger and scales correctly; "small head iceberg
 * lettuce — 1 ea" is one head. Requiring a unit keeps those out.
 */
export function unscalableLines(recipe: Recipe): string[] {
  return (recipe.ingredients ?? [])
    .filter(
      (line) =>
        looksPlaceholder(line.qty, line.unit) && AMOUNT_IN_NAME.test(line.item),
    )
    .map((line) => line.item);
}

/**
 * True when so much of a recipe is broken that no number on its sheet can be
 * trusted — the sheet prints dashes rather than multiplications.
 *
 * Distinct from `unscalableLines`, which flags individual rows. A recipe with
 * six bad lines out of twenty-one still has fifteen good ones, and blanking
 * those would throw away the part that works.
 */
export function hasUnscalableAmounts(recipe: Recipe): boolean {
  const lines = recipe.ingredients ?? [];
  if (lines.length < 3) return false;
  return unscalableLines(recipe).length / lines.length >= 0.5;
}

/**
 * A yield too small to have come from a person counting people.
 *
 * Published recipes are written for four, six, eight. Almost none are written
 * for one or two, and a saved recipe that says so is nearly always an import
 * that read a volume yield — "2 cups" of salsa — as a headcount. That mistake
 * is invisible on the sheet, because a wrong `serves` produces numbers that
 * are internally consistent and merely enormous: every line is multiplied by
 * the same wrong factor, so nothing looks out of place next to anything else.
 *
 * Fixing the importer stops new ones arriving. It does nothing for the
 * recipes already saved, which is why this check is on the job and not only
 * on the import.
 *
 * Deliberately not a check on the scale factor. Cooking a dish for six at a
 * hundred guests is ×18 and perfectly ordinary, so a threshold there would
 * cry wolf on the normal case and get ignored by the time it mattered.
 */
const IMPLAUSIBLE_SERVES = 3;

export function suspectYield(recipe: Recipe): boolean {
  const serves = recipe.serves;
  return Number.isFinite(serves) && serves >= 1 && serves <= IMPLAUSIBLE_SERVES;
}

/** The warning an operator sees when a dish's yield can't be believed. */
export function suspectYieldWarning(recipe: Recipe): string {
  if (!suspectYield(recipe)) return "";

  return (
    `"${recipe.name}" says it serves ${recipe.serves}, which is small enough to be wrong. ` +
    `Salsas, dips and dressings are published as "2 cups" or "500 ml", and an import used to read that number as a headcount — ` +
    `so a dish that actually feeds a table gets multiplied as though it fed two, and the order comes back many times too big. ` +
    `Open the dish, check what it really serves, and save it before ordering from this sheet.`
  );
}

/** The warning an operator sees, naming the dish and the lines to fix. */
export function unscalableWarning(recipe: Recipe): string {
  const broken = unscalableLines(recipe);
  if (broken.length === 0) return "";

  // Name them. "Some lines are wrong" sends a cook hunting through twenty-one
  // rows; naming three and counting the rest is a job they can actually do.
  const shown = broken.slice(0, 3).map((item) => `"${item}"`).join(", ");
  const rest = broken.length > 3 ? ` and ${broken.length - 3} more` : "";
  const count = broken.length === 1 ? "1 line" : `${broken.length} lines`;

  return (
    `"${recipe.name}" has ${count} whose amount is in the ingredient name instead of the Amount column — ${shown}${rest}, each sitting on a row that says 1 ea. ` +
    `Those lines have been multiplied as though they were one of something, so their numbers on this job are wrong. ` +
    `Open the dish and put the amounts in the Amount and Unit columns.`
  );
}
