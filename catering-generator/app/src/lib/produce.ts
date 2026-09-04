/**
 * Ordering fresh produce the way you actually buy it.
 *
 * Nobody at the greengrocer weighs out 380 g of carrot. You pick up four
 * carrots, one cabbage, a head of broccoli. Grams are the right unit for a
 * butcher and for the bench, and the wrong unit for a crate of vegetables.
 *
 * So a produce line that has ended up in grams or kilos is turned into a count
 * of whole items. Three rules keep it honest:
 *
 *   It rounds up, always. Three and a bit cabbages is four cabbages, because
 *   the fourth one is not sold in bits. Rounding a shopping list down is how
 *   you get to the last tray and run out.
 *
 *   It runs after the lines are combined, not before. Two dishes each wanting
 *   1.2 carrots is 2.4 carrots — three of them. Converted before combining
 *   it would round each dish up on its own and buy four.
 *
 *   Every converted line is marked as an assumption and shows the weight used.
 *   An average carrot is an estimate in exactly the way a density is: useful
 *   for a shopping list, not something to present as a measurement. The figure
 *   is written into the basis line so it can be argued with, because carrots
 *   in March are not carrots in September.
 *
 * The weights below are what one item gives you *after trimming* — a head of
 * broccoli is about 450 g on the scale and about 300 g of florets in the bowl.
 * Recipe amounts are prepped amounts, so the usable weight is the one that
 * makes the count come out right.
 *
 * Only things genuinely sold by the piece are in here. Potatoes, tomatoes and
 * pumpkin go by the kilo at every supplier worth using, and "150 potatoes" is
 * a worse line than "16 kg". When in doubt it is left as a weight.
 *
 * The same complaint applies to things already counted, which is the harder
 * half. A recipe says "3 sprigs of rosemary" and "2 cloves of garlic" because
 * that is how you cook. Scaled to ninety guests those become "146 ea" and
 * "113 ea" — numbers with no shop behind them. Nobody sells a sprig, and
 * standing at the greengrocer holding a bunch you still have to work out how
 * many bunches 146 sprigs is. So a count of parts is turned into a count of
 * the whole thing the part came off, by the same three rules.
 */

import { roundUnits } from "./round.ts";
import type { OrderLine } from "./types.ts";

interface Piece {
  /** What one of them is called: "carrot", "head", "bunch". */
  one: string;
  /** What several are called. Spelled out rather than derived, because
   *  "bunch" takes -es, "zucchini" takes nothing, and a shopping list that
   *  says "1 cabbages" reads like a machine wrote it. */
  many: string;
  /** Usable weight of one, in grams, after trimming and peeling. */
  grams: number;
  /** How it reads in the basis line: "100 g a carrot". */
  each: string;
}

/**
 * Matched on the ingredient name containing the key, longest key first, so
 * "red cabbage" wins over "cabbage" and "spring onion" over "onion".
 */
const head = (grams: number, each: string): Piece => ({
  one: "head",
  many: "heads",
  grams,
  each,
});
const bunch = (grams: number, each: string): Piece => ({
  one: "bunch",
  many: "bunches",
  grams,
  each,
});

const PIECES: Record<string, Piece> = {
  // Brassicas — the ones that come as a single lump you can't halve at the shop
  "red cabbage": cabbage(900),
  "green cabbage": cabbage(900),
  "savoy cabbage": cabbage(800),
  wombok: { one: "wombok", many: "wombok", grams: 900, each: "900 g a wombok" },
  cabbage: cabbage(900),
  broccolini: bunch(175, "175 g a bunch"),
  broccoli: head(300, "300 g of florets a head"),
  cauliflower: head(600, "600 g of florets a head"),

  // Roots and alliums
  carrot: { one: "carrot", many: "carrots", grams: 100, each: "100 g a carrot" },
  "spring onion": bunch(90, "90 g a bunch"),
  "red onion": onion(),
  "brown onion": onion(),
  onion: onion(),
  leek: {
    one: "leek",
    many: "leeks",
    grams: 200,
    each: "200 g of white and pale green a leek",
  },
  garlic: {
    one: "bulb",
    many: "bulbs",
    grams: 40,
    each: "40 g of peeled cloves a bulb",
  },

  // Fruiting vegetables
  capsicum: {
    one: "capsicum",
    many: "capsicums",
    grams: 150,
    each: "150 g a capsicum",
  },
  zucchini: {
    one: "zucchini",
    many: "zucchini",
    grams: 180,
    each: "180 g a zucchini",
  },
  eggplant: {
    one: "eggplant",
    many: "eggplants",
    grams: 300,
    each: "300 g an eggplant",
  },
  cucumber: {
    one: "cucumber",
    many: "cucumbers",
    grams: 300,
    each: "300 g a continental cucumber",
  },
  avocado: {
    one: "avocado",
    many: "avocados",
    grams: 150,
    each: "150 g of flesh an avocado",
  },
  "corn cob": { one: "cob", many: "cobs", grams: 120, each: "120 g of kernels a cob" },
  "sweet corn": { one: "cob", many: "cobs", grams: 120, each: "120 g of kernels a cob" },
  "butternut pumpkin": {
    one: "butternut",
    many: "butternuts",
    grams: 800,
    each: "800 g a butternut",
  },

  // Leaves
  "iceberg lettuce": lettuce(500),
  "cos lettuce": lettuce(300),
  lettuce: lettuce(400),
  silverbeet: bunch(400, "400 g a bunch"),
  kale: bunch(200, "200 g of picked leaves a bunch"),
  asparagus: bunch(150, "150 g a bunch"),
  celery: bunch(700, "700 g of trimmed sticks a bunch"),

  // Soft herbs, which come in a bunch and nothing else
  parsley: bunch(30, "30 g of picked leaves a bunch"),
  coriander: bunch(30, "30 g of picked leaves a bunch"),
  mint: bunch(25, "25 g of picked leaves a bunch"),
  basil: bunch(25, "25 g of picked leaves a bunch"),
  dill: bunch(25, "25 g of picked fronds a bunch"),
};

/**
 * A thing recipes count that shops don't sell.
 *
 * The figures are what a bunch off a Mudgee greengrocer's shelf actually
 * holds, picked deliberately on the low side. Under-counting what is in a
 * bunch buys a spare bunch; over-counting sends you back out mid-prep, and the
 * herbs are the cheapest thing on the whole order to be generous with.
 */
interface Part {
  /** What the recipe counts, plural: "sprigs", "cloves", "leaves". */
  parts: string;
  /** How many of those come in one of the thing the shop sells. */
  per: number;
  /** What you buy: "bunch", "bulb". */
  one: string;
  many: string;
}

const bunched = (parts: string, per: number): Part => ({
  parts,
  per,
  one: "bunch",
  many: "bunches",
});

const PARTS: Record<string, Part> = {
  "garlic clove": { parts: "cloves", per: 10, one: "bulb", many: "bulbs" },

  // Woody herbs, where a sprig is what a recipe asks for
  "rosemary sprig": bunched("sprigs", 20),
  "thyme sprig": bunched("sprigs", 40),
  "oregano sprig": bunched("sprigs", 30),
  "sage leaf": bunched("leaves", 60),
  // Bay is deliberately absent: it comes dried in a packet far more often than
  // fresh in a bunch, and "1 bunch of bay leaves" would send you looking for
  // something the shop hasn't got.

  // Soft herbs
  "parsley sprig": bunched("sprigs", 30),
  "coriander sprig": bunched("sprigs", 30),
  "mint sprig": bunched("sprigs", 25),
  "basil leaf": bunched("leaves", 100),
  "basil sprig": bunched("sprigs", 20),
  "dill sprig": bunched("sprigs", 25),

  // Sold in a rubber band, never singly
  "spring onion": bunched("onions", 7),
};

/**
 * Herbs there is no other way to buy.
 *
 * A line that says "Parsley — 7 ea" is the recipe's own unit coming through
 * untouched, and it leaves a real question at the shop: seven bunches, or
 * seven sprigs? One parsley *is* one bunch — that is the only parsley you can
 * pick up — so the number stands and the unit is named. Marked as an
 * assumption, because the recipe never actually said.
 */
const BUNCH_ONLY = [
  "parsley",
  "coriander",
  "mint",
  "basil",
  "dill",
  "chives",
  "rosemary",
  "thyme",
  "oregano",
  "sage",
  "tarragon",
];

function cabbage(grams: number): Piece {
  return { one: "cabbage", many: "cabbages", grams, each: `${grams} g a cabbage` };
}

function lettuce(grams: number): Piece {
  return { one: "lettuce", many: "lettuces", grams, each: `${grams} g a lettuce` };
}

function onion(): Piece {
  return { one: "onion", many: "onions", grams: 130, each: "130 g an onion" };
}

/**
 * Words that mean this is not the fresh item, whatever else the name says.
 *
 * "Garlic powder" contains "garlic" and is a jar off a shelf. "Onion powder"
 * is not an onion. Turning either into bulbs would be worse than leaving the
 * grams alone, so anything carrying one of these is left exactly as it is.
 */
const NOT_FRESH = [
  "powder",
  "dried",
  "ground",
  "paste",
  "puree",
  "purée",
  "juice",
  "tinned",
  "canned",
  "frozen",
  "pickled",
  "seed",
  "oil",
  "salt",
  "stock",
  "sauce",
  "mix",
  "cake",
  "flake",
];

/** Longest first, so a specific name beats the general one it contains. */
const PIECE_KEYS = Object.keys(PIECES).sort((a, b) => b.length - a.length);
const PART_KEYS = Object.keys(PARTS).sort((a, b) => b.length - a.length);

/** A line already counted in bunches is already right; only weights convert. */
const GRAMS_PER: Record<string, number> = { g: 1, kg: 1000 };

function pieceFor(item: string): { key: string; piece: Piece } | null {
  const name = item.toLowerCase();
  if (NOT_FRESH.some((word) => name.includes(word))) return null;
  for (const key of PIECE_KEYS) {
    if (name.includes(key)) return { key, piece: PIECES[key] };
  }
  return null;
}

function partFor(item: string): Part | null {
  const name = item.toLowerCase();
  if (NOT_FRESH.some((word) => name.includes(word))) return null;
  for (const key of PART_KEYS) {
    if (name.includes(key)) return PARTS[key];
  }
  return null;
}

/**
 * Turn a count of parts into a count of what the shop sells.
 *
 * Everything here is already counted, so there is no weight to work from and
 * nothing to reconcile with a price per kilo — a bunch is what you ask for and
 * a bunch is what you're charged for.
 */
function toWholeCount(line: OrderLine): OrderLine {
  const quantity = line.rawQty ?? line.qty;
  if (!Number.isFinite(quantity) || quantity <= 0) return line;

  const name = line.item.toLowerCase();
  if (NOT_FRESH.some((word) => name.includes(word))) return line;

  const part = partFor(line.item);
  if (part) {
    const count = roundUnits(quantity / part.per);
    const { one, many } = part;
    return {
      ...line,
      qty: count,
      // The unrounded figure counts sprigs. Left on a line counted in bunches
      // it would have anything that totals lines adding sprigs to bunches.
      rawQty: undefined,
      unit: count === 1 ? one : many,
      basis: `${line.basis} · ${round(quantity)} ${part.parts} at ${part.per} ${part.parts} a ${one}, rounded up to whole ${many}`,
      assumption: true,
    };
  }

  const herb = BUNCH_ONLY.find((leaf) => name.includes(leaf));
  if (!herb) return line;

  // The number is left exactly as the recipe had it. Only the unit is named,
  // because "ea" of a thing sold in bunches can only have meant bunches.
  return {
    ...line,
    unit: line.qty === 1 ? "bunch" : "bunches",
    basis: `${line.basis} · written as "ea", and ${herb} is only sold in bunches`,
    assumption: true,
  };
}

/**
 * Turn combined produce weights — and counts of parts — into whole items.
 *
 * Call this on the finished order sheet, after combining and after costing.
 * Costing works in the unit a price is quoted in — per kilo — so it has to see
 * the weight. The count is a shopping unit, not an accounting one.
 */
export function toWholeProduce(lines: OrderLine[]): OrderLine[] {
  return lines.map((line) => {
    if (line.category !== "Produce") return line;

    if (line.unit === "ea") return toWholeCount(line);

    const perGram = GRAMS_PER[line.unit];
    if (!perGram) return line;

    const quantity = line.rawQty ?? line.qty;
    if (!Number.isFinite(quantity) || quantity <= 0) return line;

    const found = pieceFor(line.item);
    if (!found) return line;

    const grams = quantity * perGram;
    const count = roundUnits(grams / found.piece.grams);
    const { one, many } = found.piece;

    return {
      ...line,
      qty: count,
      // The unrounded figure is in grams. Carrying it onto a line counted in
      // carrots would have anything that totals lines adding the two together.
      rawQty: undefined,
      unit: count === 1 ? one : many,
      basis: `${line.basis} · ${round(grams)} g at ${found.piece.each}, rounded up to whole ${many}`,
      assumption: true,
    };
  });
}

function round(grams: number): number {
  return Math.round(grams);
}
