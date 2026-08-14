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
}

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
    const unit = UNITS[multipack[3].toLowerCase()];
    if (packs !== null && size !== null && unit) {
      return {
        item: multipack[4].trim(),
        qty: Number((packs * size).toFixed(3)),
        unit,
        category: categoryFor(multipack[4]),
      };
    }
  }

  // "5 kg beef brisket" / "500g butter" / "2 bunches broccolini"
  const withUnit = /^([\d.,/ ]+?)\s*([a-zA-Z]+)\.?\s+(.+)$/.exec(line);
  if (withUnit) {
    const qty = parseQty(withUnit[1]);
    const unit = UNITS[withUnit[2].toLowerCase()];
    if (qty !== null && unit) {
      return {
        item: withUnit[3].trim(),
        qty,
        unit,
        category: categoryFor(withUnit[3]),
      };
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

  // "Salt and pepper" — no quantity given. Keep it: a line on the order sheet
  // with no number is still better than forgetting it entirely.
  return { item: line, qty: 1, unit: "ea", category: categoryFor(line) };
}

export function parseIngredients(text: string): ParsedIngredient[] {
  return text
    .split(/\r?\n/)
    .map(parseIngredientLine)
    .filter((row): row is ParsedIngredient => row !== null);
}
