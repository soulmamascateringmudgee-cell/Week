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
