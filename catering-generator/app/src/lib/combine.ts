import { roundForUnit } from "./round.ts";
import type { OrderLine } from "./types.ts";

/**
 * Collapse repeated ingredients into one line per item.
 *
 * A canapé menu might use bacon in the sausage rolls, the quiche and the
 * potatoes. Three separate bacon lines is three chances to order the wrong
 * amount, and nobody stands at the butcher's counter adding them up. One line
 * with the total, and the dishes it covers named underneath.
 */

/** Mass and volume are summed in the small unit, then shown in a sensible one. */
const FAMILIES: Record<string, { base: string; big: string; step: number }> = {
  g: { base: "g", big: "kg", step: 1000 },
  kg: { base: "g", big: "kg", step: 1000 },
  ml: { base: "ml", big: "L", step: 1000 },
  L: { base: "ml", big: "L", step: 1000 },
};

/** "Beef Brisket " and "beef brisket" are the same thing on an order sheet. */
function key(item: string): string {
  return item.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,;]+$/, "");
}

/**
 * One entry per dish, not one per line.
 *
 * A recipe can name the same ingredient twice — cayenne in the marinade and
 * cayenne in the dredge — and each is its own line coming in here. Printed
 * straight, the bracket says the dish's name twice with a number after each,
 * which reads like two dishes and invites the cook to weigh out both. They are
 * one pot's worth; they add.
 *
 * Only amounts in the same unit are added, for the same reason the totals
 * above are: a bunch and a kilo don't sum, and a wrong total in a bracket is
 * as bad as a wrong total anywhere else.
 */
function perDish(lines: OrderLine[]): { dish: string; qty: number; unit: string }[] {
  const parts: { dish: string; qty: number; unit: string }[] = [];

  for (const line of lines) {
    const already = parts.find(
      (part) => part.dish === line.forDish && part.unit === line.unit,
    );
    if (already) already.qty = roundForUnit(already.qty + line.qty, line.unit);
    else parts.push({ dish: line.forDish, qty: line.qty, unit: line.unit });
  }
  return parts;
}

export function combineOrders(orders: OrderLine[]): OrderLine[] {
  const groups = new Map<string, OrderLine[]>();

  for (const line of orders) {
    const family = FAMILIES[line.unit];
    // Group by item and by what it can be added to. A recipe measured in
    // bunches can't be totalled with one measured in kilos, so those stay
    // apart rather than being merged into a wrong number.
    const groupKey = `${key(line.item)}|${family ? family.base : line.unit}`;
    const existing = groups.get(groupKey);
    if (existing) existing.push(line);
    else groups.set(groupKey, [line]);
  }

  const combined: OrderLine[] = [];

  for (const lines of groups.values()) {
    if (lines.length === 1) {
      combined.push(lines[0]);
      continue;
    }

    const family = FAMILIES[lines[0].unit];
    const total = lines.reduce((sum, line) => {
      // Rounded figures rounded again drift upward, so add the raw ones.
      const value = line.rawQty ?? line.qty;
      if (!family) return sum + value;
      // Convert everything to the small unit before adding.
      return sum + (line.unit === family.big ? value * family.step : value);
    }, 0);

    let qty = total;
    let unit = family ? family.base : lines[0].unit;
    if (family && total >= family.step) {
      qty = total / family.step;
      unit = family.big;
    }

    const dishes = [...new Set(lines.map((line) => line.forDish))];

    combined.push({
      // Keep the first spelling — it's the one the operator typed.
      item: lines[0].item,
      qty: roundForUnit(qty, unit),
      rawQty: qty,
      unit,
      category: lines[0].category,
      forDish: dishes.join(", "),
      // What to weigh out for each pot, beside the one amount to buy. The
      // rounded per-dish figures are the ones a cook works to, so those are
      // what travel — not the raw values the total was added from.
      split: perDish(lines),
      basis: `${lines.length} dishes added together — ${lines
        .map((line) => `${line.qty} ${line.unit} for ${line.forDish}`)
        .join("; ")}`,
      assumption: lines.some((line) => line.assumption),
      // One bad line poisons the total it is added into, so the flag survives
      // the merge. Dropping it here would launder a wrong number into a
      // combined line that looks like every other one.
      ...(lines.some((line) => line.unscalable) ? { unscalable: true } : {}),
    });
  }

  return combined;
}

/**
 * Drop any per-dish split that no longer matches the total it sits beside.
 *
 * A split is only ever printed in brackets after the total, so the two have to
 * be readable as one statement: 47 g, of which 30 g here and 17 g there. Once
 * a later step has changed the line's unit — produce counted into whole
 * onions, a spice put back into spoons that its parts were too small to reach
 * — the bracket would be in different units from the number in front of it,
 * or its pieces would no longer add up to it. Either way the cook is left
 * doing the arithmetic the sheet exists to have done.
 *
 * So the parts have to be in the line's own unit and add up to it, near enough
 * that rounding explains the rest. Anything else loses its bracket and keeps
 * its total, which is the half that has to be right.
 */
export function checkedSplits(lines: OrderLine[]): OrderLine[] {
  return lines.map((line) => {
    if (!line.split || line.split.length < 2) {
      return line.split ? { ...line, split: undefined } : line;
    }

    const sameUnit = line.split.every((part) => part.unit === line.unit);
    const total = line.split.reduce((sum, part) => sum + part.qty, 0);
    // Each part was rounded on its own, so the sum can sit a little either
    // side of the total. A tenth of the total, or one whole unit, covers that
    // without letting a genuinely wrong bracket through.
    const slack = Math.max(line.qty * 0.1, 1);

    if (!sameUnit || Math.abs(total - line.qty) > slack) {
      return { ...line, split: undefined };
    }
    return line;
  });
}
