/**
 * What's already in the pantry, set against what the job needs.
 *
 * The order sheet has always ended with "what's already in the pantry, freezer
 * and packaging store? Shop that first — it comes straight off this order."
 * That's a note asking a person to do arithmetic in their head at the shops.
 * This does it on the page instead.
 *
 * The governing rule: **the order line is never quietly reduced.** A pantry
 * count is a memory of a Tuesday, and by Friday somebody has used the tomatoes
 * for staff lunch. So a line shows all three numbers — what the job needs,
 * what the count says you have, and the difference — and lets the cook decide
 * which one to trust. Silently shipping a smaller number would be the app
 * telling you it knows something it doesn't.
 *
 * Where the two units can't be reconciled — 2 kg of cabbage in the coolroom
 * against a line reading 3 cabbages — no subtraction is attempted. The line
 * says there's some in the pantry and leaves the judgement where it belongs.
 */

import { quantityInPricedUnit } from "./costing.ts";
import { roundForUnit } from "./round.ts";
import type { OrderLine, StockItem } from "./types.ts";

/** "Beef Brisket " and "beef brisket" are the same thing. Matches costing. */
function normalise(item: string): string {
  return item.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,;]+$/, "");
}

/**
 * The ingredient without its preparation.
 *
 * Recipes in this app are written "item, prep" — "Carrots, grated", "Green
 * cabbage, finely shredded". A pantry is not kept that way: you have carrots,
 * and what you do to them is the job's business. So a stock line matches the
 * head of the name as well as the whole of it.
 *
 * Deliberately only the first comma, and nothing cleverer. Matching on any
 * shared word would have "carrots" answering for "carrot cake mix", and a
 * false match here means turning up to a job short.
 */
function head(item: string): string {
  const [first] = normalise(item).split(",");
  return first.trim();
}

export interface StockCover {
  /** How much the count says is on hand, in the pantry's own unit. */
  have: number;
  haveUnit: string;
  /**
   * What still needs buying, in the order line's unit — or null when the two
   * units can't be reconciled and no subtraction is honest.
   */
  buy: number | null;
  /** True when the pantry covers the whole line and nothing need be bought. */
  covered: boolean;
}

/**
 * Mark every order line that the pantry can answer for.
 *
 * Returns new lines; nothing is mutated and no quantity is changed. The
 * `inStock` note is added alongside the amount the job actually needs.
 */
export function applyStock(lines: OrderLine[], stock: StockItem[]): OrderLine[] {
  if (stock.length === 0) return lines;

  // Whole name first, then the name without its prep. A pantry line naming the
  // exact thing beats a looser match on the head of it.
  const byName = new Map<string, StockItem>();
  const byHead = new Map<string, StockItem>();
  for (const entry of stock) {
    if (!Number.isFinite(entry.qty) || entry.qty <= 0) continue;
    byName.set(normalise(entry.item), entry);
    const h = head(entry.item);
    // Two pantry lines sharing a head — "carrots, baby" and "carrots" — would
    // make the loose match arbitrary. Keep the first and let the exact match
    // do the work for the other.
    if (!byHead.has(h)) byHead.set(h, entry);
  }

  return lines.map((line) => {
    const found =
      byName.get(normalise(line.item)) ?? byHead.get(head(line.item));
    if (!found) return line;

    const needed = line.rawQty ?? line.qty;
    // The pantry amount expressed in the order's unit — kilos against grams,
    // litres against millilitres. Null when they're different measures.
    const haveInOrderUnit = quantityInPricedUnit(
      found.qty,
      found.unit,
      line.unit,
    );

    if (haveInOrderUnit === null) {
      return {
        ...line,
        inStock: {
          have: found.qty,
          haveUnit: found.unit,
          buy: null,
          covered: false,
        },
      };
    }

    const shortfall = needed - haveInOrderUnit;
    return {
      ...line,
      inStock: {
        have: found.qty,
        haveUnit: found.unit,
        // Rounded the same way the order line was, so "buy 4.5 kg" is a number
        // a supplier can actually pick rather than 4.4732.
        buy: shortfall > 0 ? roundForUnit(shortfall, line.unit) : 0,
        covered: shortfall <= 0,
      },
    };
  });
}

/** How many lines the pantry answers for, whole or in part. */
export function stockedCount(lines: OrderLine[]): number {
  return lines.filter((line) => line.inStock).length;
}
