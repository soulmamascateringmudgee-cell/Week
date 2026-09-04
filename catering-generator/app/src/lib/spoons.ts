/**
 * Spices belong in spoons.
 *
 * Nobody weighs smoked paprika. You reach for a teaspoon, because that is the
 * instrument the jar is designed around and the amount is too small for a
 * scale to be worth fetching. "23 g of garlic powder" is a number you have to
 * translate before you can act on it, at the bench, mid-prep — which is the
 * same complaint as ordering cabbage in grams, and gets the same answer: give
 * the amount in the unit the job is actually done in.
 *
 * Two things make this safe to do.
 *
 * **It usually removes an estimate rather than adding one.** A recipe says
 * "2 tsp", the app scales that to 20 tsp, and only then applies a density to
 * reach grams — the density being a guess about how tightly a powder packs.
 * Coming back to spoons undoes that same arithmetic and lands on a number that
 * was exact all along. Where a recipe genuinely gave grams, the density runs
 * the other way and the row is marked as an assumption, as it should be.
 *
 * **There is a ceiling.** Past a certain amount a spoon stops being the right
 * tool: "38 tablespoons" is worse than "700 g", not better. Above the ceiling
 * the weight stands, which is also what you want when the question is what to
 * buy rather than what to measure.
 */

import { densityFor } from "./measure.ts";
import type { OrderLine, ScaledIngredient } from "./types.ts";

/** Australian metric standard: 4 teaspoons to the tablespoon, not 3. */
const TSP_ML = 5;
const TBSP_ML = 20;

/**
 * The most a spoon should be asked to measure: eight tablespoons.
 *
 * Chosen because counting is the limit, not volume. Eight scoops is a thing a
 * person will do; twenty is a thing they will get wrong halfway through and
 * start again. Above this the row keeps the weight it had, which suits both
 * ends of the job — a scale is quicker at that size, and 700 g is what tells
 * you how big a jar to buy.
 */
const MAX_SPOON_ML = 8 * TBSP_ML;

/**
 * Names measured with a spoon rather than a scale.
 *
 * Every entry is here on its own merits, not by family resemblance, because
 * the near misses are the whole difficulty: "garlic powder" is spooned and
 * garlic is not, "chilli powder" is and a fresh chilli is not, "ground
 * coriander" is and a bunch of coriander is emphatically not. So the list
 * names the spice, never the plant.
 *
 * Matched on whole words, so "salt" cannot catch "salted butter" and "cumin"
 * cannot catch something that merely contains those letters.
 */
const SPOONED = [
  // Ground spices
  "paprika",
  "smoked paprika",
  "sweet paprika",
  "cumin",
  "ground cumin",
  "ground coriander",
  "turmeric",
  "ground ginger",
  "cinnamon",
  "ground cinnamon",
  "nutmeg",
  "allspice",
  "ground cloves",
  "cardamom",
  "cayenne",
  "chilli powder",
  "chili powder",
  "chilli flakes",
  "chili flakes",
  "red pepper flakes",
  "curry powder",
  "garam masala",
  "five spice",
  "ras el hanout",
  "sumac",
  "zaatar",
  "za'atar",
  "mustard powder",
  "ground mustard",
  "garlic powder",
  "onion powder",
  "stock powder",

  // Pepper, named specifically. Bare "pepper" is left alone: half the time it
  // means a capsicum.
  "black pepper",
  "white pepper",
  "ground pepper",
  "cracked pepper",
  "peppercorns",

  // Salt. Large jobs pass the ceiling and go back to weight, which is right —
  // you buy salt by the kilo and measure it by the spoon.
  "salt",
  "sea salt",
  "table salt",
  "kosher salt",
  "celery salt",

  // Dried leaf herbs. "Dried" is required for the ones that also come fresh:
  // a recipe asking for thyme may well mean sprigs, and turning those into
  // teaspoons would be wrong in a way nobody would notice.
  "dried oregano",
  "dried thyme",
  "dried rosemary",
  "dried sage",
  "dried basil",
  "dried parsley",
  "dried mint",
  "mixed herbs",
  "italian herbs",
  "herbes de provence",
  "bouquet garni",

  // Seeds
  "cumin seeds",
  "coriander seeds",
  "fennel seeds",
  "mustard seeds",
  "sesame seeds",
  "caraway seeds",
  "nigella seeds",
  "poppy seeds",

  // Baking, where a quarter teaspoon is the difference between a cake and a
  // biscuit.
  "baking powder",
  "baking soda",
  "bicarb soda",
  "bicarbonate of soda",
  "cream of tartar",
  "dried yeast",
  "instant yeast",
  "xanthan gum",
  "gelatine powder",

  // Extracts, which are liquid but never bought or measured by the litre.
  "vanilla extract",
  "vanilla essence",
  "vanilla bean paste",
  "almond extract",
] as const;

/**
 * Whole-word matching, longest name first.
 *
 * Longest first so the specific name wins where one contains another —
 * "smoked paprika" over "paprika", "celery salt" over "salt" — which matters
 * only for what gets named in the basis line, since both are spooned either
 * way. Whole words because substring matching on a list like this is how
 * "salted butter" ends up being measured in teaspoons.
 */
const SPOON_KEYS = [...SPOONED].sort((a, b) => b.length - a.length);

const WORD_BOUNDARY = /[^a-z0-9]/;

/** True when `name` contains `key` as whole words rather than inside a word. */
function hasWords(name: string, key: string): boolean {
  let from = 0;
  for (;;) {
    const at = name.indexOf(key, from);
    if (at === -1) return false;
    const before = at === 0 ? " " : name[at - 1];
    const afterAt = at + key.length;
    const after = afterAt >= name.length ? " " : name[afterAt];
    if (WORD_BOUNDARY.test(before) && WORD_BOUNDARY.test(after)) return true;
    from = at + 1;
  }
}

/** The spice this line is, or null if it's something you weigh. */
export function spoonedAs(item: string): string | null {
  const name = item.toLowerCase();
  for (const key of SPOON_KEYS) {
    if (hasWords(name, key)) return key;
  }
  return null;
}

export interface Spoonful {
  qty: number;
  unit: "tsp" | "tbsp";
}

/**
 * Millilitres as a spoon measure, or null if it's too much to spoon.
 *
 * Rounded to a quarter, because that is the finest graduation a spoon set has
 * and the precision a recipe is written to. Anything that rounds to nothing is
 * held at a quarter teaspoon rather than disappearing: a pinch of cayenne is
 * still a line on the sheet.
 */
export function asSpoons(ml: number): Spoonful | null {
  if (!Number.isFinite(ml) || ml <= 0 || ml > MAX_SPOON_ML) return null;

  // A tablespoon once there are four teaspoons in it, so nothing prints as
  // "6 tsp" where "1½ tbsp" is the same amount and one scoop and a half.
  const unit = ml < TBSP_ML ? "tsp" : "tbsp";
  const per = unit === "tsp" ? TSP_ML : TBSP_ML;
  const quarters = Math.max(1, Math.round((ml / per) * 4));
  return { qty: quarters / 4, unit };
}

/**
 * Millilitres as a spoon measure in a spoon size somebody else chose.
 *
 * `asSpoons` picks the size that reads best for one amount on its own. The
 * parts of a split don't get that freedom: they are printed in brackets after
 * a total and have to be in the total's unit, or the bracket says "4½ tbsp
 * (chicken 3½ tbsp, sliders 3 tsp)" and the cook is left checking whether
 * those add up. Same quarters, same arithmetic, unit fixed from outside.
 */
export function asSpoonsIn(ml: number, unit: "tsp" | "tbsp"): Spoonful | null {
  if (!Number.isFinite(ml) || ml <= 0 || ml > MAX_SPOON_ML) return null;
  const per = unit === "tsp" ? TSP_ML : TBSP_ML;
  const quarters = Math.max(1, Math.round((ml / per) * 4));
  return { qty: quarters / 4, unit };
}

/** Millilitres behind a line, using its density where it's been weighed. */
function millilitresOf(
  qty: number,
  unit: string,
  item: string,
): { ml: number; viaDensity: string | null } | null {
  if (!Number.isFinite(qty) || qty <= 0) return null;

  if (unit === "ml") return { ml: qty, viaDensity: null };
  if (unit === "L") return { ml: qty * 1000, viaDensity: null };

  if (unit === "g" || unit === "kg") {
    const grams = unit === "kg" ? qty * 1000 : qty;
    const density = densityFor(item);
    // No density means no honest way back to a volume, so the weight stands.
    if (!density) return null;
    return { ml: grams / density.gramsPerMl, viaDensity: density.key };
  }

  return null;
}

/** What one converted line becomes, or null when it should be left alone. */
function toSpoonLine(
  qty: number,
  unit: string,
  item: string,
): { qty: number; unit: string; note: string; assumed: boolean } | null {
  const key = spoonedAs(item);
  if (!key) return null;

  const volume = millilitresOf(qty, unit, item);
  if (!volume) return null;

  const spoons = asSpoons(volume.ml);
  if (!spoons) return null;

  const per = spoons.unit === "tsp" ? TSP_ML : TBSP_ML;
  const asked = volume.viaDensity
    ? `${round(qty)} ${unit} of ${key} at ${densityFor(item)?.gramsPerMl} g per ml = ${round(volume.ml)} ml`
    : `${round(volume.ml)} ml of ${key}`;

  return {
    qty: spoons.qty,
    unit: spoons.unit,
    note: `${asked}, measured at ${per} ml a ${spoons.unit === "tsp" ? "teaspoon" : "tablespoon"}`,
    // Only the weight-to-volume direction is a guess. Coming back from grams
    // that this app itself worked out from spoons recovers the original
    // number, but the line was already marked when it went the other way, so
    // marking it again costs nothing and covers the recipe that gave grams.
    assumed: volume.viaDensity !== null,
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Put the spices on an order sheet back into spoons.
 *
 * Runs last, after the lines have been combined and costed, for the same
 * reasons the produce count does. After combining, so a paprika used in three
 * dishes is one row of spoons rather than three that can't be added up — the
 * totalling is done in millilitres and grams, where it works. After costing,
 * because a price is quoted per kilo and the costing has to see the kilos.
 */
export function toSpoonMeasures(lines: OrderLine[]): OrderLine[] {
  return lines.map((line) => {
    const spooned = toSpoonLine(line.rawQty ?? line.qty, line.unit, line.item);
    if (!spooned) return line;

    // The per-dish amounts come along, through the same conversion. A row
    // reading "1½ tbsp (chicken 30 g, slaw 17 g)" mixes two units on one line
    // and makes the cook do the sum the sheet was supposed to do. Any part
    // that won't convert — too small to be a quarter spoon, too big to count
    // — takes the whole split with it rather than leaving a bracket whose
    // pieces don't add up to the number in front of them.
    const split = line.split?.map((part) => {
      const volume = millilitresOf(part.qty, part.unit, line.item);
      if (!volume) return null;
      const each = asSpoonsIn(volume.ml, spooned.unit as "tsp" | "tbsp");
      return each ? { dish: part.dish, qty: each.qty, unit: each.unit } : null;
    });

    return {
      ...line,
      qty: spooned.qty,
      rawQty: undefined,
      unit: spooned.unit,
      ...(split
        ? { split: split.every((part) => part !== null) ? split : undefined }
        : {}),
      basis: `${line.basis} · ${spooned.note}`,
      assumption: line.assumption || spooned.assumed,
    };
  });
}

/** The same, for the amounts on a dish's own bench sheet. */
export function scaledToSpoonMeasures(
  ingredients: ScaledIngredient[],
): ScaledIngredient[] {
  return ingredients.map((ingredient) => {
    const spooned = toSpoonLine(
      ingredient.qty,
      ingredient.unit,
      ingredient.item,
    );
    if (!spooned) return ingredient;
    return { ...ingredient, qty: spooned.qty, unit: spooned.unit };
  });
}
