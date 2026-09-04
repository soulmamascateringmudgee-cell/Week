/**
 * The checking either side of a suggested grouping.
 *
 * Kept out of the route so it can be tested without a network, a key or a
 * signed-in user — the same reason `pages.ts` sits beside the upload routes.
 * The route does the talking; this decides what is allowed through.
 *
 * Both directions are guarded, and the second one is the one that matters. A
 * grouping is applied to the rows positionally, so a reply that came back one
 * short would slide every heading up a line and file the topping's flour under
 * the filling. That is worse than no headings at all: it is wrong, it is
 * invisible, and it looks exactly as considered as a right answer. So a reply
 * that doesn't line up is thrown away whole rather than partly used.
 */

/** More lines than any one dish has, and a cheap guard on a paid call. */
export const MAX_INGREDIENTS = 60;

/** Longer than this is a sentence, not a heading. */
const MAX_PART = 60;

/**
 * The ingredient names to be sorted, or null when the body isn't the shape we
 * need.
 *
 * Names only, deliberately: the model is being asked which bowl a line goes
 * in, and an amount cannot help it answer that. Not sending the numbers is
 * also the cheapest possible guarantee that none of them comes back changed.
 */
export function collectItems(ingredients: unknown): string[] | null {
  if (!Array.isArray(ingredients)) return null;

  const items: string[] = [];
  for (const entry of ingredients) {
    const item =
      typeof entry === "string"
        ? entry
        : typeof entry === "object" && entry !== null
          ? (entry as { item?: unknown }).item
          : undefined;
    if (typeof item !== "string" || item.trim() === "") return null;
    items.push(item.trim().slice(0, 200));
  }
  return items;
}

/**
 * A suggested grouping, checked against the list it was asked about.
 *
 * Null when it doesn't line up, which the caller must treat as "change
 * nothing" rather than as "use what fits".
 */
export function checkParts(parts: unknown, expected: number): string[] | null {
  if (!Array.isArray(parts)) return null;
  if (parts.length !== expected) return null;
  if (parts.some((part) => typeof part !== "string")) return null;

  return (parts as string[]).map((part) =>
    part.replace(/\s+/g, " ").trim().slice(0, MAX_PART),
  );
}

/**
 * The prompt's body: the dish, its method, and its ingredients numbered in
 * order.
 *
 * Numbered because the answer is positional. Asking for "one per ingredient"
 * against an unnumbered list is asking a reader to count to twelve without
 * losing their place, and the failure is silent.
 */
export function partsPrompt(
  name: string,
  method: string,
  items: string[],
): string {
  return (
    `Dish: ${name || "(unnamed)"}\n\n` +
    `Method:\n${method.slice(0, 20000)}\n\n` +
    `Ingredients, in order (${items.length}):\n` +
    items.map((item, n) => `${n + 1}. ${item}`).join("\n") +
    `\n\nReturn ${items.length} parts, one per ingredient, in this order.`
  );
}
