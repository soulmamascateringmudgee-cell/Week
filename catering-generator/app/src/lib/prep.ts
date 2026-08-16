/**
 * Turns the dishes on a job into a dated prep list.
 *
 * The countdown in `tables.ts` covers the admin — lock the menu, order day,
 * final numbers. It says nothing about the cooking, because it doesn't know
 * what's on the menu. This does: it reads each recipe's own method and works
 * out which day the work has to start.
 *
 * A 12 hour lamb has to go in the night before. A pavlova has to be baked the
 * day before. Scones have to be made on the morning. Getting that wrong is how
 * a job comes apart at 6am, so the cues below are deliberately conservative:
 * when a dish could go either way, it lands on the earlier day.
 */

import { addDays, formatDate, parseISODate } from "./dates.ts";
import type { DishSheet, PrepDay, PrepTaskLine, Recipe } from "./types.ts";

/**
 * Each rule is tried in order and the first match wins, so the slowest,
 * least forgiving jobs claim a dish before the gentler rules get a look at it.
 */
interface Rule {
  daysOut: number;
  test: RegExp;
  task: (dish: string) => string;
  because: string;
}

const RULES: Rule[] = [
  {
    daysOut: 2,
    test: /marinate\s+(?:it\s+)?(?:for\s+)?(?:24|48|24\s*-\s*48)\s*hrs?|24-48|marinate 24/i,
    task: (dish) => `Start the marinade for ${lower(dish)}`,
    because: "the method asks for 24 to 48 hours in the marinade",
  },
  {
    daysOut: 1,
    test: /\b(?:10|11|12|14|16)\s*(?:to|-|–)?\s*(?:12|14|16)?\s*hrs?\b.*overnight|overnight.*\b(?:10|12)\s*(?:to|-|–)\s*12\s*hrs?|12 hour|slow cooker.*\b(?:8|10|12)\s*hrs?|\b(?:8|10|12)\s*hrs?\s*(?:low|on low)/i,
    task: (dish) => `${dish} goes in overnight — set an alarm to check it`,
    because: "it needs an oven or slow cooker running through the night",
  },
  // "Marinate" and "marinade" are instructions. "Marinated artichokes" is an
  // ingredient, and matching it put a grazing platter on the marinade list.
  // Checked before the chill rule so a marinade is described as a marinade.
  {
    daysOut: 1,
    test: /\bmarinate\b|\bmarinating\b|\bmarinade\b/i,
    task: (dish) => `Marinate ${lower(dish)}`,
    because: "it needs time in the marinade before it is cooked",
  },
  // Anything that has to sit and set is a hard constraint, so it is settled
  // before the day-of rule below. A mousse that chills four hours cannot be
  // made on the morning just because its raspberries go on at the last minute.
  // Two hours is the floor — a one hour rest is not a reason to move a day.
  {
    daysOut: 1,
    test: /chill (?:at least )?(?:[2-9]|\d{2})\s*hrs?|set (?:at least )?(?:[2-9]|\d{2})\s*hrs?|refrigerate overnight|chill overnight/i,
    task: (dish) => `Make ${lower(dish)} — it needs hours in the fridge to set`,
    because: "it has to chill for hours before it can be served",
  },
  // Checked before the make-ahead rules below. A recipe often makes one
  // component ahead and assembles on the day — the baguette whose mayo is made
  // the day before is still a day-of job, because assembly is what ruins it.
  {
    daysOut: 0,
    test: /best on the day|made and baked fresh|fresh this morning|cut it the morning|assemble the morning of|no earlier|no more than|just before serving|30 min before/i,
    task: (dish) => `${dish} — this one is made on the day`,
    because: "it does not survive being made ahead",
  },
  {
    daysOut: 1,
    test: /make ahead[:,]?\s*(?:it is |it's )?better (?:the )?(?:next day|on day two)|better the next day|better on day two/i,
    task: (dish) => `Make ${lower(dish)} — it is better on day two`,
    because: "the method says it improves overnight",
  },
  {
    daysOut: 1,
    test: /make ahead|bake (?:it )?the day before|the day before|chill (?:at least )?\d+\s*hrs?|overnight is better|keeps a week|weeks in the fridge/i,
    task: (dish) => `Make ${lower(dish)} ahead`,
    because: "it keeps, so it does not need to compete with the event day",
  },
];

/** A dish with a PREP: block but no timing cue still needs a prep day. */
const HAS_PREP_BLOCK = /(^|\n)\s*PREP\s*:/i;

function lower(dish: string): string {
  // Leave acronyms and anything already capitalised mid-word alone.
  return /^[A-Z][a-z]/.test(dish) ? dish[0].toLowerCase() + dish.slice(1) : dish;
}

function labelFor(daysOut: number): string {
  if (daysOut === 0) return "Event day";
  if (daysOut === 1) return "The day before";
  return `${daysOut} days before`;
}

function classify(recipe: Recipe): { daysOut: number; task: string; because: string } | null {
  const text = `${recipe.method ?? ""}\n${recipe.notes ?? ""}`;
  if (!text.trim()) return null;

  for (const rule of RULES) {
    if (rule.test.test(text)) {
      return {
        daysOut: rule.daysOut,
        task: rule.task(recipe.name),
        because: rule.because,
      };
    }
  }

  if (HAS_PREP_BLOCK.test(text)) {
    return {
      daysOut: 1,
      task: `Prep ${lower(recipe.name)} — chopping, sauces, anything that keeps`,
      because: "the recipe has a prep step that can be done ahead",
    };
  }

  return null;
}

/**
 * Build the prep list. Dishes with nothing time-sensitive in their method are
 * left off rather than padded onto the list — a prep list nobody trusts is
 * worse than a short one.
 */
export function buildPrepPlan(
  recipes: Recipe[],
  /** The same dishes at this job's size, so each task carries its amounts. */
  sheets: DishSheet[],
  eventDateISO: string,
  todayISO: string,
): PrepDay[] {
  const eventDate = parseISODate(eventDateISO);
  const today = parseISODate(todayISO);

  const amounts = new Map(sheets.map((sheet) => [sheet.name, sheet.ingredients]));
  const byDay = new Map<number, PrepTaskLine[]>();

  for (const recipe of recipes) {
    const hit = classify(recipe);
    if (!hit) continue;
    const lines = byDay.get(hit.daysOut) ?? [];
    lines.push({
      dish: recipe.name,
      task: hit.task,
      because: hit.because,
      ingredients: amounts.get(recipe.name) ?? [],
    });
    byDay.set(hit.daysOut, lines);
  }

  if (byDay.size === 0) return [];

  // Once there's any cooking at all, the cold chain matters on the day.
  const eventDay = byDay.get(0) ?? [];
  eventDay.push({
    dish: "Load out",
    task: "Load the car cold — eskies and ice bricks, not just the boot",
    because: "cold chain is the one thing you cannot fix on site",
    ingredients: [],
  });
  byDay.set(0, eventDay);

  return [...byDay.keys()]
    .sort((a, b) => b - a)
    .map((daysOut) => ({
      daysOut,
      date: formatDate(addDays(eventDate, -daysOut)),
      label: labelFor(daysOut),
      overdue: addDays(eventDate, -daysOut).getTime() < today.getTime(),
      tasks: byDay.get(daysOut) ?? [],
    }));
}
