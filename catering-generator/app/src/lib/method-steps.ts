/**
 * A method as steps a cook can find their place in.
 *
 * Recipes arrive as one run of prose. Printed as one run of prose it is a
 * paragraph the size of a hand, and the cook coming back to it with wet hands
 * has to re-read from the top to work out where they were. Nothing about the
 * words is wrong — it is the shape.
 *
 * Two things are pulled out, and only two, because both are already on the
 * page and neither has to be guessed:
 *
 *   The break between steps. Recipes are written a step to a line, and the
 *   line breaks are already in the text.
 *
 *   The label a step starts with. "PREP:", "Apple filling –", "BUTTERSCOTCH
 *   SAUCE:" — the cook's own name for that stage, which is what the eye
 *   actually lands on when it comes back to the page.
 *
 * Nothing is reworded, reordered, joined or dropped. Put the steps back
 * together with a newline between them and you have the method that went in.
 */

/**
 * A leading label: a short run in capitals, or a few capitalised words, closed
 * by a colon or a dash.
 *
 * Deliberately tight. A step is only labelled when the recipe labelled it, so
 * the pattern has to match "Crumble topping –" and "GLUTEN FREE:" without
 * matching "Bake 30 to 35 min until a skewer comes out" — a sentence with a
 * dash in it somewhere is not a labelled step, so the label may not contain
 * sentence punctuation and may not run past a few words.
 */
const LABEL = /^([A-Z][^.!?:–—\n]{1,30}?)\s*(?::|\s[–—-]\s)\s*(?=\S)/;

/**
 * Is this candidate a name for a stage, or the front half of a sentence?
 *
 * The dash is the dangerous one. "Bake for 30 to 40 minutes — until golden
 * brown" would otherwise put six words of an ordinary instruction in bold on
 * every recipe that punctuates that way, which is worse than no labels at all:
 * bold that lands anywhere stops meaning anything.
 *
 * Two rules, both read off the real book. Every label in it is three words or
 * fewer — "PREP", "SPICE MIX", "Crumble topping", "BUTTERSCOTCH SAUCE",
 * "AIOLI, day ahead" — and not one contains a digit, while the sentences that
 * false-match are longer and full of times and temperatures.
 */
function isLabel(candidate: string): boolean {
  if (/\d/.test(candidate)) return false;
  return candidate.split(/\s+/).length <= 3;
}

export interface MethodStep {
  /** The cook's own name for this stage, or null when they didn't give one. */
  label: string | null;
  /** Everything after the label. Never empty. */
  text: string;
}

/**
 * Split a method into its steps.
 *
 * Empty when there is no method. A method with no line breaks comes back as
 * one step, which is the honest answer: nothing on the page said where to
 * break it, and inventing breaks would put a step boundary in the middle of
 * somebody's sentence.
 */
export function methodSteps(method: string | null | undefined): MethodStep[] {
  if (typeof method !== "string" || method.trim() === "") return [];

  return method
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .map((line) => {
      // A numbered step — "1. Marinate the chicken" — is already labelled by
      // its position on the page, and lifting the digit out as a heading gives
      // a step called "1". Strip the numeral, keep the sentence.
      const numbered = line.replace(/^\(?\d{1,2}[.)]\s+/, "");
      const match = LABEL.exec(numbered);
      if (!match || !isLabel(match[1].trim())) {
        return { label: null, text: numbered };
      }

      const text = numbered.slice(match[0].length).trim();
      // A label with nothing under it is a heading, not a step; keep the whole
      // line as text rather than printing a bold word alone on the page.
      if (text === "") return { label: null, text: numbered };
      return { label: match[1].trim(), text };
    });
}
