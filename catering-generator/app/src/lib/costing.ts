import type { IngredientPrice, JobCosting, OrderLine } from "./types.ts";

/**
 * What the food on this order list costs, and whether it fits the budget.
 *
 * The rule this file exists to enforce: never present a partial total as if it
 * were the whole. A menu where half the ingredients have no price is not a
 * $400 menu — it's a menu with an unknown on it, and quoting off the known
 * half is how a caterer ends up working for nothing.
 */

/** Prices are per kg or per L; order lines might be in g or ml. */
const CONVERT: Record<string, { to: string; factor: number }> = {
  g: { to: "kg", factor: 0.001 },
  kg: { to: "kg", factor: 1 },
  ml: { to: "L", factor: 0.001 },
  L: { to: "L", factor: 1 },
};

function normalise(item: string): string {
  return item.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,;]+$/, "");
}

/**
 * Quantity expressed in the unit the price is quoted in, or null when the two
 * can't be reconciled — a price per kilo against a line reading "3 bunches"
 * is not a sum anyone should guess at.
 */
export function quantityInPricedUnit(
  qty: number,
  lineUnit: string,
  priceUnit: string,
): number | null {
  if (lineUnit === priceUnit) return qty;

  const from = CONVERT[lineUnit];
  const to = CONVERT[priceUnit];
  if (from && to && from.to === to.to) {
    return (qty * from.factor) / to.factor;
  }
  return null;
}

export function costOrders(
  orders: OrderLine[],
  prices: IngredientPrice[],
  guests: number,
  budget?: number,
): JobCosting {
  const byItem = new Map<string, IngredientPrice>();
  for (const price of prices) byItem.set(normalise(price.item), price);

  let total = 0;
  const priced: JobCosting["priced"] = [];
  const unpriced: string[] = [];
  const mismatched: string[] = [];

  for (const line of orders) {
    const price = byItem.get(normalise(line.item));
    if (!price) {
      unpriced.push(line.item);
      continue;
    }

    const quantity = quantityInPricedUnit(
      line.rawQty ?? line.qty,
      line.unit,
      price.unit,
    );
    if (quantity === null) {
      // Priced, but in a unit that doesn't line up. Say so rather than
      // multiplying two numbers that don't belong together.
      mismatched.push(`${line.item} — priced per ${price.unit}, ordered in ${line.unit}`);
      continue;
    }

    const cost = quantity * price.price;
    total += cost;
    priced.push({
      item: line.item,
      cost: Math.round(cost * 100) / 100,
      basis: `${Math.round(quantity * 100) / 100} ${price.unit} × $${price.price.toFixed(2)}`,
    });
  }

  const roundedTotal = Math.round(total * 100) / 100;
  const complete = unpriced.length === 0 && mismatched.length === 0;

  return {
    total: roundedTotal,
    perHead: guests > 0 ? Math.round((roundedTotal / guests) * 100) / 100 : 0,
    priced: priced.sort((a, b) => b.cost - a.cost),
    unpriced: [...new Set(unpriced)],
    mismatched: [...new Set(mismatched)],
    complete,
    budget,
    budgetPerHead:
      budget !== undefined && guests > 0
        ? Math.round((budget / guests) * 100) / 100
        : undefined,
    // Only a complete costing can be called over or under. A partial total
    // that happens to sit below the budget tells you nothing.
    verdict:
      budget === undefined
        ? "no-budget"
        : !complete
          ? "incomplete"
          : roundedTotal > budget
            ? "over"
            : "under",
  };
}
