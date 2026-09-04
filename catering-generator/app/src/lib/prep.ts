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
import { type MethodStep, methodSteps } from "./method-steps.ts";
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

/**
 * A step that names its own day, so it can leave the dish's day behind.
 *
 * A dish lands on one day, but its work rarely does. The popcorn chicken is a
 * day-of fry whose aioli the cook's own method labels "AIOLI, day ahead"; the
 * pudding is a day-ahead bake that is still sauced and warmed at service. A
 * prep list that files every step under the dish's one day is telling a cook
 * to do the aioli in the middle of service.
 *
 * Read off the step's own words and nothing else. A step with no cue stays
 * with its dish, which is the safe place for it: guessing a step onto an
 * earlier day is how something gets made before it should be, and guessing it
 * later is how it does not get made at all.
 */
const STEP_DAYS: { daysOut: number; test: RegExp }[] = [
  { daysOut: 2, test: /\b(?:24\s*(?:to|-|–)\s*48|48)\s*hrs?\b|two days (?:ahead|before)|2 days (?:ahead|before)/i },
  {
    daysOut: 1,
    test: /\bday (?:ahead|before)\b|\bmake ahead\b|\bnight before\b|\bovernight\b|\bthe day before\b|better the next day/i,
  },
  {
    daysOut: 0,
    test: /\bon the day\b|\bthe morning of\b|\bmorning of\b|\bat service\b|\bjust before serving\b|\bto serve\b|\bno earlier\b|\bfresh this morning\b/i,
  },
];

/**
 * A step whose label is itself a staging instruction.
 *
 * "MORNING", "TO SERVE", "DAY AHEAD" are the cook labelling when, not what,
 * and they are unambiguous in a way prose is not — the lamb's "MORNING:
 * uncover, crank to 220C" belongs on the event day even though the dish went
 * in the night before. Matched whole, so a "MORNING GLORY MUFFINS" heading
 * isn't read as a time of day.
 */
const LABEL_DAYS: { daysOut: number; test: RegExp }[] = [
  { daysOut: 2, test: /^two days (?:ahead|before)$/i },
  { daysOut: 1, test: /^(?:make ahead|day (?:ahead|before)|the day before|night before|overnight)$/i },
  { daysOut: 0, test: /^(?:morning|the morning|on the day|day of|to serve|at service|service|serving|assembly|assemble)$/i },
];

/**
 * The day this step names for itself, or null when it doesn't name exactly one.
 *
 * Null when two cues land in the same step — "marinate 24 hrs, assemble the
 * morning of" names both ends of the job in one breath, and picking one of
 * them here would quietly overrule the dish rules above, which read the whole
 * method and are ordered so the least forgiving timing wins.
 */
export function dayForStep(step: MethodStep): number | null {
  const label = step.label?.trim() ?? "";
  const staged = LABEL_DAYS.find((rule) => rule.test.test(label));
  if (staged) return staged.daysOut;

  const text = `${label} ${step.text}`;
  const hits = STEP_DAYS.filter((rule) => rule.test.test(text));
  return hits.length === 1 ? hits[0].daysOut : null;
}

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

    // The dish's steps, filed under the day each one names for itself and
    // otherwise under the dish's own day. A dish whose method says "AIOLI, day
    // ahead" has work on two days, and a list that says so is the difference
    // between a calm morning and making mayonnaise during service.
    const steps = methodSteps(recipe.method);
    // A method written as one paragraph has one "step", and that step is the
    // whole method. Re-dating it here would be deciding the dish's day again
    // from a single cue, when the rules above already weighed every cue in it.
    // Splitting needs a method that is actually written in steps.
    const splittable = steps.length > 1;

    const stepsByDay = new Map<number, MethodStep[]>();
    for (const step of steps) {
      const day = (splittable ? dayForStep(step) : null) ?? hit.daysOut;
      stepsByDay.set(day, [...(stepsByDay.get(day) ?? []), step]);
    }
    // A dish always appears on its own day, even when every step named another
    // one — that day is what the timing rules decided, and dropping it would
    // take the dish off the list its reason belongs to.
    if (!stepsByDay.has(hit.daysOut)) stepsByDay.set(hit.daysOut, []);

    for (const [daysOut, steps] of stepsByDay) {
      const own = daysOut === hit.daysOut;
      byDay.set(daysOut, [
        ...(byDay.get(daysOut) ?? []),
        {
          dish: recipe.name,
          task: own ? hit.task : `${recipe.name} — the part that has to happen now`,
          because: own
            ? hit.because
            : "the method puts this step on this day, not the dish's own day",
          // The amounts belong beside the dish's main entry. Repeating the
          // whole list under a single step that was pulled onto another day
          // would say the whole dish is made twice.
          ingredients: own ? (amounts.get(recipe.name) ?? []) : [],
          steps,
        },
      ]);
    }
  }

  if (byDay.size === 0) return [];

  // Once there's any cooking at all, the cold chain matters on the day.
  const eventDay = byDay.get(0) ?? [];
  eventDay.push({
    dish: "Load out",
    task: "Load the car cold — eskies and ice bricks, not just the boot",
    because: "cold chain is the one thing you cannot fix on site",
    ingredients: [],
    steps: [],
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
