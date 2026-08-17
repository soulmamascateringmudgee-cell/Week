/**
 * Turning invoice lines into comparable prices, and saying what moved.
 *
 * An invoice line is "Brisket  12.5 kg  @ 18.50  231.25". A price list wants
 * "brisket, $18.50 per kg". Two things have to happen in between, and both are
 * places a wrong number could get in quietly:
 *
 *   1. **Normalise the unit.** A line billed in grams and a price stored per
 *      kilo are the same price wearing different clothes. Comparing them
 *      without converting reports a 1000x rise.
 *   2. **Refuse to compare what isn't comparable.** Per-kilo against
 *      per-bunch is not a price rise, it's a different way of buying the
 *      thing. Saying "up 400%" there would be worse than saying nothing.
 *
 * So every comparison either produces a number it can stand behind, or says
 * plainly that it can't.
 */

/** Units that mean the same measure at a different scale. */
const FAMILIES: Record<string, { canonical: string; perCanonical: number }> = {
  g: { canonical: "kg", perCanonical: 1000 },
  kg: { canonical: "kg", perCanonical: 1 },
  ml: { canonical: "L", perCanonical: 1000 },
  l: { canonical: "L", perCanonical: 1 },
};

/** "KG" and " kg " are the same unit; "Bunches" and "bunches" are too. */
export function normaliseUnit(unit: string): string {
  const trimmed = unit.trim();
  const family = FAMILIES[trimmed.toLowerCase()];
  return family ? family.canonical : trimmed.toLowerCase();
}

export interface InvoiceLine {
  item: string;
  /** How much was billed, in `unit`. */
  qty: number;
  unit: string;
  /** What the whole line cost, in dollars. */
  lineTotal: number;
}

export interface UnitPrice {
  item: string;
  price: number;
  unit: string;
}

/**
 * A line's price per canonical unit — per kilo, per litre, or per whatever it
 * was counted in.
 *
 * Returns null rather than a number when the arithmetic can't be trusted: a
 * zero or missing quantity would divide by zero, and a negative total is a
 * credit note line, not a price.
 */
export function toUnitPrice(line: InvoiceLine): UnitPrice | null {
  if (!Number.isFinite(line.qty) || line.qty <= 0) return null;
  if (!Number.isFinite(line.lineTotal) || line.lineTotal < 0) return null;

  const family = FAMILIES[line.unit.trim().toLowerCase()];
  // 500 g becomes 0.5 kg, so the price comes out per kilo.
  const qtyInCanonical = family ? line.qty / family.perCanonical : line.qty;
  if (qtyInCanonical <= 0) return null;

  return {
    item: line.item.trim().toLowerCase(),
    // Rounded to the cent once, at the end. Money that carries fractions of a
    // cent through later arithmetic drifts.
    price: Math.round((line.lineTotal / qtyInCanonical) * 100) / 100,
    unit: normaliseUnit(line.unit),
  };
}

export type ChangeKind = "new" | "up" | "down" | "same" | "unit-changed";

export interface PriceChange {
  kind: ChangeKind;
  /** How far it moved, as a percentage. Absent when there's nothing to compare. */
  percent?: number;
  /** What to tell the cook, in their terms. */
  note: string;
}

/** Under this, a move is rounding rather than news. */
const SAME_WITHIN_PERCENT = 0.5;

/**
 * What happened to one ingredient's price.
 *
 * `current` is null when the ingredient has never been priced.
 */
export function describeChange(
  current: { price: number; unit: string } | null,
  next: { price: number; unit: string },
): PriceChange {
  const money = (n: number) => `$${n.toFixed(2)}`;

  if (!current) {
    return {
      kind: "new",
      note: `New — ${money(next.price)} a ${next.unit}`,
    };
  }

  if (normaliseUnit(current.unit) !== normaliseUnit(next.unit)) {
    // Not a price move. Per-kilo against per-bunch is a different way of
    // buying the thing, and a percentage here would be invented.
    return {
      kind: "unit-changed",
      note: `Was priced per ${normaliseUnit(current.unit)}, this one's per ${normaliseUnit(
        next.unit,
      )} — check which is right`,
    };
  }

  if (current.price === 0) {
    // Percentages off a zero base are infinite, which is no use to anyone.
    return {
      kind: next.price > 0 ? "up" : "same",
      note: `Was ${money(0)}, now ${money(next.price)} a ${next.unit}`,
    };
  }

  const percent = ((next.price - current.price) / current.price) * 100;
  const rounded = Math.round(percent * 10) / 10;

  if (Math.abs(rounded) < SAME_WITHIN_PERCENT) {
    return { kind: "same", percent: 0, note: `No change — ${money(next.price)} a ${next.unit}` };
  }

  const direction = rounded > 0 ? "Up" : "Down";
  return {
    kind: rounded > 0 ? "up" : "down",
    percent: rounded,
    note: `${direction} ${Math.abs(rounded)}% — ${money(current.price)} to ${money(
      next.price,
    )} a ${next.unit}`,
  };
}

/**
 * The lines worth putting in front of someone, most significant first.
 *
 * A twenty-line invoice where two things moved should show those two. Sorting
 * by how far the price moved puts the money at the top, which is where a cook
 * looks first and stops.
 */
export function worthMentioning<T extends { change: PriceChange }>(
  rows: T[],
): T[] {
  return rows
    .filter((row) => row.change.kind !== "same")
    .sort((a, b) => {
      const rank = (kind: ChangeKind) =>
        kind === "unit-changed" ? 3 : kind === "new" ? 2 : 1;
      // Anything needing a decision outranks a plain price move.
      const byRank = rank(b.change.kind) - rank(a.change.kind);
      if (byRank !== 0) return byRank;
      return Math.abs(b.change.percent ?? 0) - Math.abs(a.change.percent ?? 0);
    });
}
