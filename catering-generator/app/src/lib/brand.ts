/**
 * Whose colours the app wears.
 *
 * This app is sold to other caterers, so its own look has to stay neutral —
 * warm paper and sage, nobody's logo. But the operator who owns it also runs
 * a catering business, and on her own phone it should look like her business
 * and not like a product she bought.
 *
 * So a brand is a stored choice on the profile, not a hardcoded email. One
 * operator's branding never leaks to another's login, and a second operator
 * who wants their own palette is a row in the table below rather than a
 * rewrite.
 *
 * The palettes themselves live in `globals.css`, keyed off `data-brand` on
 * the html element. This module exists to decide *which* key gets written
 * there, and to refuse to write anything else.
 */

export interface Brand {
  key: string;
  /** What the operator picks in Account. */
  label: string;
  /** One line saying what it looks like, so the choice can be made blind. */
  note: string;
}

export const BRANDS: Brand[] = [
  {
    key: "soul-mamas",
    label: "Soul Mamas — dark",
    note: "Charcoal, burgundy and ochre, with Playfair and Montserrat. The wordmark on black.",
  },
  {
    key: "soul-mamas-light",
    label: "Soul Mamas — cream",
    note: "The same brand the other way up: warm cream, burgundy and ochre. Easier in a bright kitchen.",
  },
];

/** The look the app ships with. Stored as null, never as a brand key. */
export const DEFAULT_BRAND_LABEL = "Plain";
export const DEFAULT_BRAND_NOTE =
  "Warm cream and sage. No business's branding on it.";

/**
 * The brand key to put in the markup, or null for the default look.
 *
 * Anything unrecognised is null rather than passed through. The value ends up
 * as an attribute on the html element, and a column that has been edited by
 * hand — or by a later version of this app that knew about a palette this one
 * doesn't — must degrade to the plain look rather than to a page with no
 * colours defined at all.
 */
export function brandKey(stored: unknown): string | null {
  if (typeof stored !== "string") return null;
  const trimmed = stored.trim().toLowerCase();
  return BRANDS.some((brand) => brand.key === trimmed) ? trimmed : null;
}

/** What to store when an operator picks a brand. Null clears it. */
export function brandToStore(chosen: unknown): string | null {
  return brandKey(chosen);
}
