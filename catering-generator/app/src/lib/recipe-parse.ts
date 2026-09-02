import { sectionHeading } from "./recipe-sections.ts";
import type { Category } from "./types.ts";

/**
 * Turn a pasted ingredient list into rows.
 *
 * Deterministic on purpose — same as the rest of the arithmetic in here. A
 * chef pasting a recipe at 6am should not be waiting on a model, paying for a
 * call, or wondering why today's parse differs from yesterday's.
 *
 * Handles the shapes recipes are actually written in:
 *
 *   5 kg beef brisket          → 5      kg      beef brisket
 *   500g butter                → 500    g       butter
 *   2 bunches broccolini       → 2      bunches broccolini
 *   1.5 L cream                → 1.5    L       cream
 *   3 x 400g tinned tomatoes   → 1200   g       tinned tomatoes
 *   1/2 cup olive oil          → 0.5    cup     olive oil
 *   Salt                       → 1      ea      Salt
 *   - 2 kg carrots, peeled     → 2      kg      carrots, peeled
 */

export interface ParsedIngredient {
  item: string;
  qty: number;
  unit: string;
  category: Category;
  /** Set only when a heading above the line said which part it belongs to. */
  section?: string;
}

/**
 * Imperial units, converted on the way in.
 *
 * American recipe sites are full of pounds and ounces, and nobody orders in
 * pounds from a Mudgee butcher. Mass converts to mass and volume to volume —
 * both exact. Cups deliberately stay as cups: a cup of flour and a cup of oil
 * are different weights, so "convert" would mean "guess", and a guess with a
 * unit on it is worse than leaving it alone.
 */
const CONVERSIONS: Record<string, { factor: number; unit: string }> = {
  oz: { factor: 28.3495, unit: "g" },
  ounce: { factor: 28.3495, unit: "g" },
  ounces: { factor: 28.3495, unit: "g" },
  lb: { factor: 0.453592, unit: "kg" },
  lbs: { factor: 0.453592, unit: "kg" },
  pound: { factor: 0.453592, unit: "kg" },
  pounds: { factor: 0.453592, unit: "kg" },
  "fl oz": { factor: 29.5735, unit: "ml" },
  floz: { factor: 29.5735, unit: "ml" },
  pint: { factor: 473.176, unit: "ml" },
  pints: { factor: 473.176, unit: "ml" },
  quart: { factor: 946.353, unit: "ml" },
  quarts: { factor: 946.353, unit: "ml" },
  gallon: { factor: 3.78541, unit: "L" },
  gallons: { factor: 3.78541, unit: "L" },
};

/** Units we recognise, mapped to how they should be written back out. */
const UNITS: Record<string, string> = {
  kg: "kg",
  kgs: "kg",
  kilo: "kg",
  kilos: "kg",
  kilogram: "kg",
  kilograms: "kg",
  g: "g",
  gm: "g",
  gms: "g",
  gram: "g",
  grams: "g",
  l: "L",
  lt: "L",
  litre: "L",
  litres: "L",
  liter: "L",
  liters: "L",
  ml: "ml",
  tbsp: "tbsp",
  tbs: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tsp: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  cup: "cup",
  cups: "cup",
  bunch: "bunches",
  bunches: "bunches",
  punnet: "punnets",
  punnets: "punnets",
  tin: "tins",
  tins: "tins",
  can: "tins",
  cans: "tins",
  jar: "jars",
  jars: "jars",
  packet: "packets",
  packets: "packets",
  pack: "packets",
  packs: "packets",
  head: "heads",
  heads: "heads",
  clove: "cloves",
  cloves: "cloves",
  sprig: "sprigs",
  sprigs: "sprigs",
  loaf: "loaves",
  loaves: "loaves",
  dozen: "dozen",
  ea: "ea",
  each: "ea",
  piece: "ea",
  pieces: "ea",
};

/**
 * Which supplier the line belongs on. Rough, and deliberately so — it only
 * decides which heading the line prints under, and the operator can change it.
 */
const CATEGORY_WORDS: [Category, string[]][] = [
  [
    "Meat/Seafood",
    ["beef", "brisket", "lamb", "pork", "chicken", "duck", "bacon", "chorizo",
      "prosciutto", "ham", "mince", "sausage", "fish", "salmon", "barramundi",
      "prawn", "squid", "octopus", "mussel", "oyster", "scallop", "steak",
      "rib", "shoulder", "thigh", "breast", "fillet"],
  ],
  [
    "Dairy",
    ["milk", "cream", "butter", "cheese", "yoghurt", "yogurt", "feta",
      "parmesan", "haloumi", "halloumi", "ricotta", "mascarpone", "creme",
      "egg", "eggs", "buttermilk"],
  ],
  [
    "Produce",
    ["onion", "garlic", "carrot", "potato", "pumpkin", "broccoli", "broccolini",
      "cauliflower", "cabbage", "lettuce", "leaves", "rocket", "spinach",
      "tomato", "cucumber", "capsicum", "zucchini", "eggplant", "beetroot",
      "fennel", "celery", "leek", "mushroom", "herb", "parsley", "coriander",
      "basil", "mint", "thyme", "rosemary", "lemon", "lime", "orange", "apple",
      "pear", "berry", "berries", "grape", "melon", "avocado", "chilli",
      "ginger", "corn", "pea", "peas", "bean", "beans", "salad", "radish",
      "asparagus", "kale", "sweet potato"],
  ],
  [
    "Drinks",
    ["juice", "wine", "beer", "cider", "soda", "lemonade", "coffee", "tea",
      "water", "cordial"],
  ],
  [
    "Packaging",
    ["foil", "cling", "container", "bag", "napkin", "glove", "label", "tray",
      "skewer", "box", "ice"],
  ],
];

function categoryFor(item: string): Category {
  const lower = item.toLowerCase();
  for (const [category, words] of CATEGORY_WORDS) {
    if (words.some((word) => lower.includes(word))) return category;
  }
  // Flour, rice, oil, spices, tins, stock — the pantry. A safe default,
  // because getting it wrong only moves which heading it prints under.
  return "Dry goods";
}

/** Round a converted figure without pretending to a precision it hasn't got. */
function tidy(value: number): number {
  if (value >= 100) return Math.round(value);
  if (value >= 10) return Math.round(value * 10) / 10;
  return Math.round(value * 100) / 100;
}

/**
 * Resolve a unit word to how it should be stored, converting imperial to
 * metric on the way. Returns null when the word isn't a unit at all.
 */
function resolveUnit(
  word: string,
  qty: number,
): { qty: number; unit: string } | null {
  const key = word.toLowerCase();

  const conversion = CONVERSIONS[key];
  if (conversion) {
    return { qty: tidy(qty * conversion.factor), unit: conversion.unit };
  }

  const unit = UNITS[key];
  return unit ? { qty, unit } : null;
}

/** "1/2" → 0.5, "1 1/2" → 1.5, "2.5" → 2.5 */
function parseQty(raw: string): number | null {
  const text = raw.trim();

  const mixed = /^(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(text);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);

  const fraction = /^(\d+)\s*\/\s*(\d+)$/.exec(text);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);

  const decimal = Number(text.replace(",", "."));
  return Number.isFinite(decimal) ? decimal : null;
}

/** Strip list markers and tidy whitespace. */
function clean(line: string): string {
  return line
    .replace(/^\s*[-*•–—]\s*/, "")
    .replace(/^\s*\d+[.)]\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseIngredientLine(rawLine: string): ParsedIngredient | null {
  const line = clean(rawLine);
  if (line === "") return null;

  // "3 x 400g tinned tomatoes" — multiply the pack out.
  const multipack =
    /^([\d.,/ ]+?)\s*[x×]\s*([\d.,/]+)\s*([a-zA-Z]+)\s+(.+)$/.exec(line);
  if (multipack) {
    const packs = parseQty(multipack[1]);
    const size = parseQty(multipack[2]);
    if (packs !== null && size !== null) {
      const resolved = resolveUnit(multipack[3], packs * size);
      if (resolved) {
        return {
          item: multipack[4].trim(),
          qty: Number(resolved.qty.toFixed(3)),
          unit: resolved.unit,
          category: categoryFor(multipack[4]),
        };
      }
    }
  }

  // "8 fl oz cream" — the only two-word unit worth handling.
  const flOz = /^([\d.,/ ]+?)\s*fl\.?\s*oz\.?\s+(.+)$/i.exec(line);
  if (flOz) {
    const qty = parseQty(flOz[1]);
    if (qty !== null) {
      const resolved = resolveUnit("fl oz", qty)!;
      return {
        item: flOz[2].trim(),
        qty: resolved.qty,
        unit: resolved.unit,
        category: categoryFor(flOz[2]),
      };
    }
  }

  // "5 kg beef brisket" / "500g butter" / "2 lb chuck" / "2 bunches broccolini"
  const withUnit = /^([\d.,/ ]+?)\s*([a-zA-Z]+)\.?\s+(.+)$/.exec(line);
  if (withUnit) {
    const qty = parseQty(withUnit[1]);
    if (qty !== null) {
      const resolved = resolveUnit(withUnit[2], qty);
      if (resolved) {
        return {
          item: withUnit[3].trim(),
          qty: resolved.qty,
          unit: resolved.unit,
          category: categoryFor(withUnit[3]),
        };
      }
    }
  }

  // "12 eggs" — a count with no unit word.
  const bare = /^([\d.,/ ]+?)\s+(.+)$/.exec(line);
  if (bare) {
    const qty = parseQty(bare[1]);
    if (qty !== null) {
      return {
        item: bare[2].trim(),
        qty,
        unit: "ea",
        category: categoryFor(bare[2]),
      };
    }
  }

  // "Bacon: 225g" / "Pork mince - 750 g" / "Chicken thigh 2kg" — the amount
  // written after the ingredient, which is how most people write a shopping
  // list. Without this the line survives as "1 ea", and an order sheet saying
  // "2 ea bacon" is worse than useless at the butcher's counter.
  const trailing = /^(.+?)\s*[:\-–—]?\s*([\d.,/]+)\s*([a-zA-Z]+)\.?$/.exec(line);
  if (trailing) {
    const qty = parseQty(trailing[2]);
    if (qty !== null) {
      const resolved = resolveUnit(trailing[3], qty);
      // Only when the tail is a real unit — "Chicken thigh 2" or "Onion x2"
      // shouldn't be read as a weight.
      if (resolved) {
        const item = trailing[1].replace(/[:\-–—\s]+$/, "").trim();
        if (item !== "") {
          return {
            item,
            qty: resolved.qty,
            unit: resolved.unit,
            category: categoryFor(item),
          };
        }
      }
    }
  }

  // "Salt and pepper" — no quantity given. Keep it: a line on the order sheet
  // with no number is still better than forgetting it entirely.
  return { item: line, qty: 1, unit: "ea", category: categoryFor(line) };
}

/**
 * Read a list of ingredient lines, keeping the headings between them.
 *
 * "For the marinade" is not an ingredient, and until this existed it became
 * one: the last resort in `parseIngredientLine` keeps any line it can't make
 * sense of, so a heading arrived on the order sheet as "1 ea For the
 * marinade". Now it does the job it was written for — everything under it
 * belongs to that part of the dish, until the next heading.
 *
 * A heading with nothing under it is dropped by simply never being stored;
 * the section only reaches a row when a row follows it.
 */
export function parseIngredientList(lines: string[]): ParsedIngredient[] {
  const rows: ParsedIngredient[] = [];
  let section: string | null = null;

  for (const line of lines) {
    const heading = sectionHeading(line);
    if (heading !== null) {
      section = heading;
      continue;
    }
    const row = parseIngredientLine(line);
    if (row === null) continue;
    rows.push(section === null ? row : { ...row, section });
  }

  return rows;
}

export function parseIngredients(text: string): ParsedIngredient[] {
  return parseIngredientList(text.split(/\r?\n/));
}
