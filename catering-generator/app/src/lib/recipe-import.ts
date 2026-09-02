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

/** Recipe yields come as "4", "Serves 6", "4-6 servings", "makes 12". */
export function parseYield(raw: unknown): number | null {
  const text = Array.isArray(raw) ? String(raw[0] ?? "") : String(raw ?? "");
  // A range means the cook wasn't sure either. Take the lower number: it's the
  // one that leaves you with enough food rather than not enough.
  const match = /(\d+(?:\.\d+)?)/.exec(text);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value >= 1 && value <= 10000
    ? Math.round(value)
    : null;
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
