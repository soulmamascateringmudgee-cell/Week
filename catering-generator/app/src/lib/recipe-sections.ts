/**
 * The parts a recipe is written in — "Dry", "Wet", "For the marinade".
 *
 * Distinct from `recipe-group.ts`, which sorts the *book* into courses. This
 * sorts one *dish* into the parts a cook mixes separately. A crumbed chicken
 * has a dry bowl, a wet bowl and a sauce, and reading them as one alphabet of
 * eleven ingredients means working the parts out again at the bench, with wet
 * hands, at six in the morning.
 *
 * Nothing here touches a number. A section is a heading; the arithmetic is the
 * same whether a dish has one section or five, which is the point — grouping
 * that could change an order sheet would be a grouping nobody dares use.
 */

/** The parts recipes are usually written in, offered as suggestions. */
export const SECTION_SUGGESTIONS = [
  "Dry",
  "Wet",
  "Marinade",
  "Sauce",
  "Dressing",
  "Topping",
  "Garnish",
  "To serve",
] as const;

/** The heading a line with no section of its own prints under. */
export const UNSECTIONED = "Ingredients";

/** Longer than this is a sentence, not a heading. */
const MAX_SECTION = 60;

/**
 * A section name as it should be stored: trimmed, whitespace collapsed, any
 * trailing colon dropped, and empty read as "no section at all".
 *
 * "Dry:", "Dry" and " dry " have to be the same section, or a dish acquires
 * three headings that all say dry and the grouping makes the recipe harder to
 * read rather than easier. Case is left alone — "For the marinade" is how a
 * cook writes it, and title-casing their words is not this file's business.
 */
export function tidySection(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[:：]+$/, "")
    .trim();
  return text === "" ? null : text.slice(0, MAX_SECTION);
}

/** Case- and punctuation-insensitive key, so "Dry:" and "dry" group together. */
function key(section: string | null): string {
  return (section ?? "").toLowerCase();
}

export interface IngredientSection<T> {
  /** Null for lines the cook never filed anywhere. */
  section: string | null;
  /** What to print above them: the section, or "Ingredients". */
  heading: string;
  ingredients: T[];
}

/**
 * Split a dish's lines into its parts, in the order they were written.
 *
 * Order of first appearance, not alphabetical: a recipe's parts are a sequence
 * — dry, then wet, then the sauce that goes over it — and sorting them would
 * shuffle the method out of step with the list.
 *
 * Lines with no section lead, under "Ingredients". A recipe part-way through
 * being organised is the normal case, and the ungrouped remainder appearing
 * last, after three headings, reads as an afterthought rather than as the main
 * body of the dish it usually is.
 *
 * Generic so the recipe book, the bench sheet and anything else showing a
 * dish's lines all group them the same way. Two copies of this would mean two
 * places for an ingredient to end up under the wrong heading.
 */
export function groupBySection<T extends { section?: string | null }>(
  ingredients: T[],
): IngredientSection<T>[] {
  const groups: IngredientSection<T>[] = [];
  const byKey = new Map<string, IngredientSection<T>>();

  for (const ingredient of ingredients) {
    const section = tidySection(ingredient.section);
    const existing = byKey.get(key(section));
    if (existing) {
      existing.ingredients.push(ingredient);
      continue;
    }
    const group: IngredientSection<T> = {
      section,
      heading: section ?? UNSECTIONED,
      ingredients: [ingredient],
    };
    byKey.set(key(section), group);
    groups.push(group);
  }

  // The unsectioned block leads, wherever its first line happened to sit.
  const loose = groups.findIndex((group) => group.section === null);
  if (loose > 0) groups.unshift(...groups.splice(loose, 1));

  return groups;
}

/**
 * True when this dish is actually written in parts.
 *
 * One heading over the whole list is decoration, and a page of decoration is a
 * page a cook scrolls past. Two or more is information.
 */
export function hasSections(
  ingredients: { section?: string | null }[],
): boolean {
  return groupBySection(ingredients).length > 1;
}

/**
 * The sections already used in this dish, for the form's suggestion list.
 *
 * The cook's own words come first: someone who typed "For the crumb" once
 * should be offered it on the next line rather than having to type it again,
 * because a section misspelt is a section that splits in two.
 */
export function sectionChoices(
  ingredients: { section?: string | null }[],
): string[] {
  const used: string[] = [];
  const seen = new Set<string>();

  for (const ingredient of ingredients) {
    const section = tidySection(ingredient.section);
    if (section === null || seen.has(key(section))) continue;
    seen.add(key(section));
    used.push(section);
  }
  for (const suggestion of SECTION_SUGGESTIONS) {
    if (seen.has(key(suggestion))) continue;
    seen.add(key(suggestion));
    used.push(suggestion);
  }
  return used;
}

/**
 * Read a pasted or imported line as a section heading, or return null.
 *
 * The shapes recipes use for a heading, and only those:
 *
 *   For the marinade      a "for the …" line, with or without a colon
 *   Dry ingredients:      the word ingredients, or a trailing colon
 *   WET                   a short line in capitals
 *
 * The bar is deliberately high, because the two ways to get this wrong are not
 * equally bad. A heading mistaken for an ingredient adds a junk line the cook
 * can see and delete; an ingredient mistaken for a heading silently drops food
 * off the order sheet. So: no digits anywhere in the line — "Bacon: 225g" is
 * an amount written after the ingredient, not a heading — and one of the three
 * shapes above, never a bare short line, or every "Salt and pepper" in the
 * book would become a heading with nothing under it.
 */
export function sectionHeading(rawLine: string): string | null {
  const line = rawLine
    .replace(/^\s*[-*•–—]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (line === "" || line.length > MAX_SECTION) return null;
  if (/[0-9¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/.test(line)) return null;

  const colon = /:$/.test(line);
  const forThe = /^for(?: the)?\s+\S/i.test(line);
  const ingredients = /\bingredients?$/i.test(line.replace(/:$/, ""));
  // Two words or fewer, no lower case, at least two letters: "DRY", "WET MIX".
  const shouted =
    /^[^a-z]+$/.test(line) &&
    /[A-Z]{2}/.test(line) &&
    line.split(" ").length <= 2;

  if (!colon && !forThe && !ingredients && !shouted) return null;

  const tidied = tidySection(line);
  if (tidied === null) return null;

  // "Dry ingredients" and "Ingredients — dry" both mean the dry bowl; the word
  // "ingredients" carries nothing a heading over a list of ingredients needs.
  // Strip it, unless it's the whole heading, where it is the honest answer.
  const trimmed = tidySection(
    tidied.replace(/\s*\bingredients?\b\s*$/i, "").replace(/[-–—:]\s*$/, ""),
  );
  return trimmed ?? tidied;
}
