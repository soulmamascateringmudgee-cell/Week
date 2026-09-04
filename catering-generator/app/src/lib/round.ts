/**
 * Round to something a supplier can actually pick and a chef can read.
 * Half-kilo steps once you're over 2 kg, 100 g steps below that.
 */
export function roundKg(kg: number): number {
  if (kg >= 2) return Math.round(kg * 2) / 2;
  return Math.round(kg * 10) / 10;
}

/** Litres to one decimal place. */
export function roundL(litres: number): number {
  return Math.round(litres * 10) / 10;
}

/** Whole units, always rounded up — you can't order 0.4 of a bun. */
export function roundUnits(units: number): number {
  return Math.ceil(units);
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** The fractions a spoon set is graduated in, and a recipe is written in. */
const QUARTERS: Record<string, string> = {
  "0.25": "¼",
  "0.5": "½",
  "0.75": "¾",
};

/**
 * An amount as a cook would write it.
 *
 * "1¼ tsp", not "1.25 tsp". The decimal is the same number and nobody measures
 * by it — a spoon set has a quarter and a half on it, so that is what the
 * sheet should say. Only spoons and cups get this: 1.25 kg is a weight off a
 * scale and reads perfectly well as a decimal.
 */
export function formatAmount(qty: number, unit: string): string {
  if (unit !== "tsp" && unit !== "tbsp" && unit !== "cup") return `${qty}`;
  if (!Number.isFinite(qty) || qty <= 0) return `${qty}`;

  const whole = Math.floor(qty);
  const fraction = QUARTERS[String(Math.round((qty - whole) * 100) / 100)];
  if (!fraction) return `${qty}`;
  return whole === 0 ? fraction : `${whole}${fraction}`;
}

/**
 * Round a scaled recipe quantity to something you can actually order.
 * Weights and volumes get sensible steps; anything you count gets rounded up,
 * because you can't buy 3.4 bunches of broccolini.
 */
export function roundForUnit(qty: number, unit: string): number {
  switch (unit) {
    case "kg":
      return roundKg(qty);
    case "L":
      return roundL(qty);
    case "g":
    case "ml":
      return qty >= 100 ? Math.round(qty / 10) * 10 : Math.round(qty);
    case "tsp":
    case "tbsp":
    case "cup":
      return round1(qty);
    default:
      return roundUnits(qty);
  }
}
