/**
 * Turning recipe measures into ordering measures.
 *
 * A recipe says "1½ cups tomato sauce" because that's how you cook. Scale it
 * to sixty-seven people and you get "41.8 cup", which is not a thing anybody
 * can order, carry, or check against a docket. Nobody at the greengrocer
 * weighs out forty-two cups of cabbage.
 *
 * So spoons and cups become millilitres, and — where we know what the thing
 * weighs — grams. Two rules keep this honest:
 *
 *   Volume conversion is exact arithmetic and is stated, not assumed. A
 *   teaspoon is 5 ml, a tablespoon is 20 ml and a cup is 250 ml, which is the
 *   Australian metric standard. The tablespoon is the one worth knowing about:
 *   most of the world uses 15 ml, so a recipe copied from an American site is
 *   a third out. The conversion is written into the basis line on every
 *   converted row so it can be argued with.
 *
 *   Weight conversion is a density, and a density is an estimate. Flour packs
 *   differently depending on who scooped it. Every row converted to grams is
 *   marked as an assumption and shows the figure used, because an estimate
 *   presented as a measurement is the failure this whole app exists to avoid.
 *
 * An ingredient we have no density for stays in millilitres rather than being
 * guessed at. Litres of shredded cabbage is imperfect; an invented weight is
 * worse.
 */

import { roundForUnit } from "./round.ts";
import type { OrderLine, ScaledIngredient } from "./types.ts";

/** Australian metric standard. The 20 ml tablespoon is the notable one. */
const ML_PER: Record<string, number> = {
  tsp: 5,
  teaspoon: 5,
  teaspoons: 5,
  tbsp: 20,
  tablespoon: 20,
  tablespoons: 20,
  cup: 250,
  cups: 250,
};

/**
 * Grams per millilitre for the things a caterer buys by weight.
 *
 * Deliberately short. Each entry is an ingredient where ordering by volume is
 * useless and the density is stable enough to be worth stating — spices you
 * buy by the jar, dry goods you buy by the bag. Anything absent stays in
 * millilitres, which is honest, rather than being assigned a number somebody
 * made up.
 *
 * Matched on the ingredient name containing the key, longest key first, so
 * "smoked paprika" wins over "paprika" and "brown sugar" over "sugar".
 */
const GRAMS_PER_ML: Record<string, number> = {
  // Dry goods
  "plain flour": 0.6,
  "self raising flour": 0.6,
  "self-raising flour": 0.6,
  flour: 0.6,
  "brown sugar": 0.8,
  "caster sugar": 0.88,
  "icing sugar": 0.5,
  sugar: 0.88,
  rice: 0.8,
  "rolled oats": 0.36,
  breadcrumbs: 0.24,
  panko: 0.24,
  "desiccated coconut": 0.34,
  cornflour: 0.6,

  // Dairy and cheese, grated
  "parmesan": 0.36,
  "grated cheese": 0.4,
  "cheddar": 0.4,

  // Produce, prepared.
  //
  // These earn their place twice over. A cup of chopped onion is unreadable on
  // an order sheet as "720 ml", and — because produce is only counted into
  // whole onions and bunches once it is a weight — a line left in millilitres
  // never gets counted at all. Giving the fresh things a density is what puts
  // them back on the sheet as four onions and a bunch of coriander.
  "shredded cabbage": 0.3,
  cabbage: 0.3,
  "grated carrot": 0.4,
  onion: 0.64,
  "spring onion": 0.4,
  celery: 0.4,
  tomato: 0.72,
  capsicum: 0.6,
  // Chopped chilli, which recipes give in spoons and shops sell by weight.
  jalapeno: 0.6,
  jalapeño: 0.6,
  serrano: 0.6,
  chilli: 0.6,
  // Soft herbs, picked and loosely chopped. A cup of them is mostly air, so
  // the density is low and the resulting weight is small — which is right: a
  // third of a cup of coriander is a fraction of one bunch, not a litre of it.
  coriander: 0.16,
  cilantro: 0.16,
  parsley: 0.16,
  mint: 0.16,
  basil: 0.16,
  dill: 0.16,
  // Seeds are not leaves. Longer key, so it wins over "coriander" above.
  "coriander seeds": 0.5,
  // Processed tomato is nearly twice the density of the chopped fruit, and is
  // what a Mexican menu actually reaches for. Longer keys, so they win.
  "tomato paste": 1.1,
  "tomato sauce": 1.1,
  "tomato passata": 1.05,
  "crushed tomato": 1.0,
  "diced tomato": 1.0,

  // Spices and dried herbs. Roughly 3 g a teaspoon for a powder, 1 g for a
  // dried leaf herb, which is where these numbers come from.
  "garlic powder": 0.6,
  "onion powder": 0.48,
  "smoked paprika": 0.46,
  paprika: 0.46,
  "ground cumin": 0.42,
  "ground coriander": 0.4,
  "curry powder": 0.44,
  "chilli powder": 0.46,
  "mustard powder": 0.4,
  cinnamon: 0.52,
  "dried oregano": 0.2,
  "dried thyme": 0.2,
  "dried rosemary": 0.2,
  "mixed herbs": 0.2,
  "black pepper": 0.46,
  salt: 1.2,
};

/** Longest first, so a specific name beats the general one it contains. */
const DENSITY_KEYS = Object.keys(GRAMS_PER_ML).sort((a, b) => b.length - a.length);

/**
 * Exported so the spoon conversion can use the same figures going the other
 * way. One table, so a density can't be right in one direction and wrong in
 * the other.
 */
export function densityFor(item: string): { key: string; gramsPerMl: number } | null {
  const name = item.toLowerCase();
  for (const key of DENSITY_KEYS) {
    if (name.includes(key)) return { key, gramsPerMl: GRAMS_PER_ML[key] };
  }
  return null;
}

export interface Measure {
  qty: number;
  unit: string;
  /** How this row got here, for the basis line. Empty when nothing changed. */
  note: string;
  /** True when a density was used — the number is an estimate, not a measure. */
  assumed: boolean;
}

/**
 * Convert a scaled recipe amount into something orderable.
 *
 * Anything already in a buying unit — kg, g, L, ml, ea, bunches — is returned
 * untouched. Only spoons and cups are converted, because only they get
 * ridiculous at scale.
 */
export function toOrderMeasure(qty: number, unit: string, item: string): Measure {
  const mlPer = ML_PER[unit.trim().toLowerCase()];
  if (!mlPer || !Number.isFinite(qty) || qty <= 0) {
    return { qty: roundForUnit(qty, unit), unit, note: "", assumed: false };
  }

  const ml = qty * mlPer;
  const spoons = `${round(qty)} ${unit} at ${mlPer} ml (Australian ${unit === "cup" ? "cup" : "spoon"})`;

  const density = densityFor(item);
  if (density) {
    const grams = ml * density.gramsPerMl;
    const [value, weightUnit] =
      grams >= 1000 ? [grams / 1000, "kg"] : [grams, "g"];
    return {
      qty: roundForUnit(value, weightUnit),
      unit: weightUnit,
      note: `${spoons} = ${round(ml)} ml, weighed at ${density.gramsPerMl} g per ml for ${density.key}`,
      assumed: true,
    };
  }

  const [value, volumeUnit] = ml >= 1000 ? [ml / 1000, "L"] : [ml, "ml"];
  return {
    qty: roundForUnit(value, volumeUnit),
    unit: volumeUnit,
    note: `${spoons} = ${round(ml)} ml`,
    assumed: false,
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Put a whole order sheet into ordering units, before the lines are combined.
 *
 * Before rather than after on purpose: a menu using three tablespoons of
 * vinegar in one dish and half a cup in another has two rows that cannot be
 * added while they're in different spoons, and would print as two separate
 * vinegar lines. In millilitres they're one line and one bottle.
 */
export function toOrderUnits(lines: OrderLine[]): OrderLine[] {
  return lines.map((line) => {
    const measure = toOrderMeasure(line.rawQty ?? line.qty, line.unit, line.item);
    if (!measure.note) return line;
    return {
      ...line,
      qty: measure.qty,
      rawQty: measure.unit === line.unit ? line.rawQty : undefined,
      unit: measure.unit,
      basis: `${line.basis} · ${measure.note}`,
      assumption: line.assumption || measure.assumed,
    };
  });
}

/** The same conversion for the amounts printed on a dish's own recipe sheet. */
export function scaledToOrderUnits(
  ingredients: ScaledIngredient[],
): ScaledIngredient[] {
  return ingredients.map((ingredient) => {
    const measure = toOrderMeasure(ingredient.qty, ingredient.unit, ingredient.item);
    if (!measure.note) return ingredient;
    return { ...ingredient, qty: measure.qty, unit: measure.unit };
  });
}
