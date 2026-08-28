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
