import { parseIngredientList } from "./recipe-parse.ts";
import type { RecipeIngredient } from "./types.ts";

/**
 * Pull a recipe out of a web page.
 *
 * Nearly every recipe site publishes schema.org Recipe data in a <script
 * type="application/ld+json"> block, because that's what makes it show up in
 * Google with a picture and a star rating. That block is structured, so
 * reading it is parsing, not guessing — no model, no cost, same answer every
 * time.
 *
 * Only the name, the yield and the ingredient list are taken. The method stays
 * on the original site, where it belongs.
 */

export interface ImportedRecipe {
  name: string;
  serves: number;
  ingredients: RecipeIngredient[];
  /** True when the yield had to be assumed rather than read off the page. */
  servesAssumed: boolean;
}

/**
 * A yield unit that measures food rather than counting people.
 *
 * Salsas, dips, dressings and sauces are published with a volume yield —
 * "2 cups", "500 ml", "1.5 kg" — because that is the useful thing to say
 * about them. The number in front of it is not a headcount and must never be
 * used as one.
 *
 * This mattered: a pico de gallo published as "2 cups" was read as serving 2,
 * so a job for 19 guests scaled it ×11.55 and asked for 35 tomatoes and a
 * litre of coriander. The recipe makes about two cups; two cups feeds a table.
 * Nothing downstream can tell a headcount of 2 from two cups, so the only
 * place to catch it is here, at the point the number is read.
 */
const FOOD_QUANTITY_UNIT =
  /^\s*(?:cups?|ml|millilitres?|milliliters?|l|litres?|liters?|g|grams?|kg|kilos?|kilograms?|oz|ounces?|lbs?|pounds?|tbsp|tablespoons?|tsp|teaspoons?|pints?|quarts?|gallons?)\b/i;

/**
 * Recipe yields come as "4", "Serves 6", "4-6 servings", "makes 12" — and as
 * "2 cups", which is not a serving count at all and returns null so the
 * caller has to ask rather than assume.
 */
export function parseYield(raw: unknown): number | null {
  // schema.org allows a list, and sites use it inconsistently: ["8"],
  // ["2 cups"], and — the dangerous one — ["2", "2 cups"], where the bare
  // number on its own looks like a headcount and is nothing of the sort.
  // Every entry gets a look, and one food measurement condemns the lot.
  const texts = (Array.isArray(raw) ? raw : [raw])
    .map((entry) => String(entry ?? ""))
    .filter((text) => text.trim() !== "");

  let headcount: number | null = null;

  for (const text of texts) {
    // A range means the cook wasn't sure either. Take the lower number: it's
    // the one that leaves you with enough food rather than not enough.
    const match = /(\d+(?:\.\d+)?)/.exec(text);
    if (!match) continue;

    if (FOOD_QUANTITY_UNIT.test(text.slice(match.index + match[0].length))) {
      return null;
    }

    const value = Number(match[1]);
    if (headcount === null && Number.isFinite(value) && value >= 1 && value <= 10000) {
      headcount = Math.round(value);
    }
  }

  return headcount;
}

/** Walk the JSON-LD graph for anything that says it's a Recipe. */
function findRecipeNode(node: unknown): Record<string, unknown> | null {
  if (Array.isArray(node)) {
    for (const entry of node) {
      const found = findRecipeNode(entry);
      if (found) return found;
    }
    return null;
  }
  if (typeof node !== "object" || node === null) return null;

  const record = node as Record<string, unknown>;
  const type = record["@type"];
  const types = Array.isArray(type) ? type : [type];
  if (types.some((t) => typeof t === "string" && t.toLowerCase() === "recipe")) {
    return record;
  }

  if (record["@graph"]) return findRecipeNode(record["@graph"]);
  return null;
}

/** Strip the tags out of an ingredient string — some sites embed markup. */
function stripTags(text: string): string {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCharCode(Number(code)),
    )
    .replace(/\s+/g, " ")
    .trim();
}

export function extractRecipe(html: string): ImportedRecipe | null {
  const blocks = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );

  for (const block of blocks) {
    let data: unknown;
    try {
      data = JSON.parse(block[1].trim());
    } catch {
      continue; // A malformed block on the page isn't our problem.
    }

    const recipe = findRecipeNode(data);
    if (!recipe) continue;

    const rawIngredients = recipe.recipeIngredient ?? recipe.ingredients;
    if (!Array.isArray(rawIngredients) || rawIngredients.length === 0) continue;

    // Read as a list rather than line by line: recipe sites put "For the
    // dressing" in the ingredient array as though it were an ingredient, and
    // it is a heading for everything after it.
    const ingredients: RecipeIngredient[] = parseIngredientList(
      rawIngredients.map((line) => stripTags(String(line))),
    );

    if (ingredients.length === 0) continue;

    const serves = parseYield(recipe.recipeYield);

    return {
      name:
        typeof recipe.name === "string" && recipe.name.trim() !== ""
          ? stripTags(recipe.name).slice(0, 200)
          : "Imported recipe",
      serves: serves ?? 4,
      servesAssumed: serves === null,
      ingredients,
    };
  }

  return null;
}
