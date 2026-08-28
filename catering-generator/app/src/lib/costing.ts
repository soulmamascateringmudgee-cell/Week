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
  // One item can carry a price from several shops. In a town with three
  // supermarkets and no wholesaler for half the list, that's the normal case,
  // not the exception.
  const byItem = new Map<string, IngredientPrice[]>();
  for (const price of prices) {
    const key = normalise(price.item);
    const existing = byItem.get(key);
    if (existing) existing.push(price);
    else byItem.set(key, [price]);
  }

  let total = 0;
  let dearestTotal = 0;
  const priced: JobCosting["priced"] = [];
  const unpriced: string[] = [];
  const mismatched: string[] = [];

  for (const line of orders) {
    const candidates = byItem.get(normalise(line.item)) ?? [];
    if (candidates.length === 0) {
      unpriced.push(line.item);
      continue;
    }

    // Cost the line at every shop that priced it in a unit this order can be
    // converted to. A price per bunch against a line in kilos is dropped here
    // rather than compared — it isn't dearer or cheaper, it's incomparable.
    const costed = candidates.flatMap((price) => {
      const quantity = quantityInPricedUnit(
        line.rawQty ?? line.qty,
        line.unit,
        price.unit,
      );
      return quantity === null ? [] : [{ price, quantity, cost: quantity * price.price }];
    });

    if (costed.length === 0) {
      // Priced, but in a unit that doesn't line up. Say so rather than
      // multiplying two numbers that don't belong together.
      const units = [...new Set(candidates.map((p) => p.unit))].join(", ");
      mismatched.push(`${line.item} — priced per ${units}, ordered in ${line.unit}`);
      continue;
    }

    // The cheapest shop wins, and the line says which one it was. A total that
    // doesn't tell you where to go isn't a shopping plan.
    const best = costed.reduce((a, b) => (b.cost < a.cost ? b : a));
    const worst = costed.reduce((a, b) => (b.cost > a.cost ? b : a));

    total += best.cost;
    dearestTotal += worst.cost;

    priced.push({
      item: line.item,
      cost: Math.round(best.cost * 100) / 100,
      basis:
        `${Math.round(best.quantity * 100) / 100} ${best.price.unit} × $${best.price.price.toFixed(2)}` +
        (best.price.supplier ? ` at ${best.price.supplier}` : ""),
      supplier: best.price.supplier ?? null,
      dearestCost:
        costed.length > 1 ? Math.round(worst.cost * 100) / 100 : undefined,
    });
  }

  const roundedTotal = Math.round(total * 100) / 100;
  const complete = unpriced.length === 0 && mismatched.length === 0;

  return {
    total: roundedTotal,
    perHead: guests > 0 ? Math.round((roundedTotal / guests) * 100) / 100 : 0,
    priced: priced.sort((a, b) => b.cost - a.cost),
    savedByShopping: Math.round((dearestTotal - total) * 100) / 100,
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
