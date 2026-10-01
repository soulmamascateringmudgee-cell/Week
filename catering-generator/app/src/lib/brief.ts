import { parseISODate } from "./dates.ts";
import { DIETARY_LABELS } from "./options.ts";
import type { MenuWeight, ServiceStyle } from "./types.ts";

/**
 * Turning a conversation into a job.
 *
 * The way a job actually arrives is as words. A client emails three
 * paragraphs. A planner sends a run sheet. You work the whole thing out with
 * an AI in a long chat and end up with the headcount, the menu, the times and
 * the crew all agreed — and then you retype every one of them into this app by
 * hand, which is the point where a 14:30 bump-in becomes 4:30 and nobody finds
 * out until the truck is late.
 *
 * So: paste the chat, or the email, or photograph the run sheet, and this
 * reads it into a proposal you confirm field by field. Nothing here saves
 * anything. Nothing here does arithmetic — the headcount goes to the same
 * engine it always did, and the quantities come out the same as if you'd typed
 * it in.
 *
 * ## The one rule everything else follows from
 *
 * **A field the brief didn't state comes back null, never a guess.** That is
 * why every number and choice below is `T | null` rather than carrying a
 * default. A brief that doesn't mention drinks is not a brief that says no
 * drinks, and a job built from "no" when the truth was "unstated" is a job
 * that turns up without glassware. null is displayed as "the brief didn't
 * say", and the form's own default stands until the operator changes it —
 * visibly, in a box they can see.
 *
 * That also means nothing in here is trusted because the model said it. Every
 * enum is checked against the list the form actually offers; every date is
 * checked for being a real day on a calendar; every dish the model claims is
 * one of her recipes is checked against her recipe book by name, and dropped
 * to "not in your book" when it isn't there. A model that invents a recipe id
 * gets you a job with food nobody costed.
 */

/** A dish the brief mentioned, and whether it's one of hers. */
export interface BriefDish {
  /** The dish as the brief wrote it. Kept verbatim — it's what she'll recognise. */
  asWritten: string;
  /**
   * The name of one of her own recipes, when this dish is that recipe. Null
   * when nothing in her book matched, which is information rather than a
   * failure: it's the list of dishes she still has to write up.
   */
  recipe: string | null;
}

/** A day's work the brief described: a prep day, a bump-in, the service. */
export interface BriefShift {
  title: string;
  /** yyyy-mm-dd. Never null — a shift without a day isn't a shift. */
  date: string;
  /** HH:MM, 24-hour, or "" when the brief gave no time. */
  startTime: string;
  endTime: string;
  location: string;
  detail: string;
  isPrep: boolean;
}

/**
 * Everything read out of one brief.
 *
 * `null` throughout means the brief didn't say. Empty string means the same
 * for the text fields, where there's no useful difference between "absent"
 * and "blank" and a null would only make every caller check twice.
 */
export interface Brief {
  /** A name for the job — "Taylor wedding, Burnbrae". "" when unnamed. */
  title: string;
  client: string;
  venue: string;
  guests: number | null;
  /** yyyy-mm-dd */
  eventDate: string | null;
  style: ServiceStyle | null;
  menuWeight: MenuWeight | null;
  serviceWindowHours: number | null;
  /** Dollars, food budget. */
  budget: number | null;
  drinksService: boolean | null;
  hotOrOutdoors: boolean | null;
  /**
   * Dietaries the planner form can hold, with a head count each. Count 0
   * means the brief named the requirement without saying how many.
   */
  dietaries: { label: string; count: number }[];
  /**
   * Dietaries the form has no box for — a shellfish allergy, coeliac by name,
   * FODMAP. Kept word for word and surfaced loudly rather than mapped onto the
   * nearest tickbox, because "nut allergy" and "sesame allergy" are not the
   * same instruction to a kitchen and quietly rounding one to the other is how
   * somebody gets hurt.
   */
  otherDietaries: string[];
  dishes: BriefDish[];
  shifts: BriefShift[];
  crewNeeded: number | null;
  /** What the reader was unsure of, in words. Shown, never hidden. */
  unclear: string[];
}

export function blankBrief(): Brief {
  return {
    title: "",
    client: "",
    venue: "",
    guests: null,
    eventDate: null,
    style: null,
    menuWeight: null,
    serviceWindowHours: null,
    budget: null,
    drinksService: null,
    hotOrOutdoors: null,
    dietaries: [],
    otherDietaries: [],
    dishes: [],
    shifts: [],
    crewNeeded: null,
    unclear: [],
  };
}

const STYLES: ServiceStyle[] = ["shared", "plated", "grazing", "van", "multiday"];
const WEIGHTS: MenuWeight[] = ["light", "standard", "feasting"];

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** True for a date that is both yyyy-mm-dd and a day that exists. */
export function isRealDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    parseISODate(value);
    return true;
  } catch {
    return false;
  }
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * A number the brief stated, or null.
 *
 * Zero is not a headcount and not a budget, so it reads as "didn't say" — the
 * schema asks for 0 in exactly that case, because a JSON schema can't express
 * an absent number as cleanly as it can express a sentinel.
 */
function positive(value: unknown, max: number): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(n, max);
}

function wholePositive(value: unknown, max: number): number | null {
  const n = positive(value, max);
  return n === null ? null : Math.round(n);
}

/** "yes" / "no" / anything else. Anything else is "didn't say". */
function tristate(value: unknown): boolean | null {
  if (value === "yes" || value === true) return true;
  if (value === "no" || value === false) return false;
  return null;
}

function oneOf<T extends string>(value: unknown, allowed: T[]): T | null {
  return typeof value === "string" && (allowed as string[]).includes(value)
    ? (value as T)
    : null;
}

function time(value: unknown): string {
  const raw = text(value, 5);
  return TIME.test(raw) ? raw : "";
}

/** For matching a dish to a recipe: case, spacing and punctuation don't count. */
function matchKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function strings(value: unknown, max: number, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    const line = text(entry, max);
    if (line !== "" && !out.includes(line)) out.push(line);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Read the model's answer into a Brief.
 *
 * `recipeNames` is her recipe book. It's the only thing that can turn a dish
 * name into a dish on the job, and a claimed match that isn't in it is
 * discarded rather than trusted — the dish still appears, as one she hasn't
 * written up.
 */
export function readBrief(raw: unknown, recipeNames: string[]): Brief {
  const brief = blankBrief();
  if (typeof raw !== "object" || raw === null) return brief;
  const row = raw as Record<string, unknown>;

  brief.title = text(row.title, 200);
  brief.client = text(row.client, 120);
  brief.venue = text(row.venue, 160);
  brief.guests = wholePositive(row.guests, 5000);
  brief.eventDate = isRealDate(row.eventDate) ? row.eventDate : null;
  brief.style = oneOf(row.style, STYLES);
  brief.menuWeight = oneOf(row.menuWeight, WEIGHTS);
  brief.serviceWindowHours = positive(row.serviceWindowHours, 24);
  brief.budget = positive(row.budget, 1_000_000);
  brief.drinksService = tristate(row.drinksService);
  brief.hotOrOutdoors = tristate(row.hotOrOutdoors);
  brief.crewNeeded = wholePositive(row.crewNeeded, 200);
  brief.unclear = strings(row.unclear, 300, 20);
  brief.otherDietaries = strings(row.otherDietaries, 200, 20);

  brief.dietaries = countKnownEquivalents(
    readDietaries(row.dietaries),
    brief.otherDietaries,
  );
  brief.dishes = readDishes(row.dishes, recipeNames);
  brief.shifts = readShifts(row.shifts);

  return brief;
}

function readDietaries(raw: unknown): { label: string; count: number }[] {
  if (!Array.isArray(raw)) return [];
  // One row per label. A brief that says "2 GF" in one line and "another
  // gluten free" in the next is 3 people, not two separate requirements.
  const counts = new Map<string, number>();
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const row = entry as Record<string, unknown>;
    const label = text(row.label, 40);
    if (!(DIETARY_LABELS as readonly string[]).includes(label)) continue;
    const count = wholePositive(row.count, 5000) ?? 0;
    counts.set(label, (counts.get(label) ?? 0) + count);
  }
  return [...counts].map(([label, count]) => ({ label, count }));
}

/**
 * Requirements she has said are the same instruction as a box on the form.
 *
 * Her call, not the reader's: coeliac is cooked as gluten free, and lactose
 * intolerance as dairy free. Everything else outside the five labels still
 * stays verbatim and uncounted, because nobody has said what it's the same as.
 */
const SAME_AS_A_BOX: { pattern: RegExp; label: (typeof DIETARY_LABELS)[number] }[] = [
  { pattern: /co?eliac/i, label: "Gluten free" },
  { pattern: /lactose/i, label: "Dairy free" },
];

/**
 * Count the requirements that belong under a box, and keep their wording.
 *
 * The entry stays in `otherDietaries` as well, so "coeliac" still reaches the
 * crew's shift note word for word — a coeliac guest needs the cross-contact
 * care that a gluten-free preference doesn't, and the box alone wouldn't say
 * so.
 *
 * The number comes from the entry itself ("2 coeliac", "coeliac x2"). With no
 * number the box is marked as named but left at zero rather than guessed at
 * one — the same rule as everywhere else here, and the planner's notice tells
 * her to count it. Where a brief gives "3 GF" and also "1 coeliac", the two are
 * added: it may be the same guest counted twice, but over-catering one plate
 * is the mistake that's safe to make with an allergy.
 */
function countKnownEquivalents(
  dietaries: { label: string; count: number }[],
  others: string[],
): { label: string; count: number }[] {
  const counts = new Map(dietaries.map((diet) => [diet.label, diet.count]));
  for (const entry of others) {
    const match = SAME_AS_A_BOX.find(({ pattern }) => pattern.test(entry));
    if (!match) continue;
    const stated = entry.match(/\d{1,4}/);
    const count = stated ? Number(stated[0]) : 0;
    counts.set(match.label, (counts.get(match.label) ?? 0) + count);
  }
  return [...counts].map(([label, count]) => ({ label, count }));
}

function readDishes(raw: unknown, recipeNames: string[]): BriefDish[] {
  if (!Array.isArray(raw)) return [];

  // Her book, keyed for matching. Built once rather than per dish.
  const book = new Map<string, string>();
  for (const name of recipeNames) {
    const key = matchKey(name);
    if (key !== "" && !book.has(key)) book.set(key, name);
  }

  const dishes: BriefDish[] = [];
  const seen = new Set<string>();

  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const row = entry as Record<string, unknown>;

    const asWritten = text(row.asWritten, 200);
    if (asWritten === "") continue;

    const key = matchKey(asWritten);
    if (seen.has(key)) continue;
    seen.add(key);

    // The claimed match has to be a recipe she actually has. Failing that,
    // the dish's own name might be one — checked second so a deliberate
    // match wins over a coincidence.
    const claimed = matchKey(text(row.recipe, 200));
    const recipe = book.get(claimed) ?? book.get(key) ?? null;

    dishes.push({ asWritten, recipe });
    if (dishes.length >= 60) break;
  }
  return dishes;
}

function readShifts(raw: unknown): BriefShift[] {
  if (!Array.isArray(raw)) return [];

  const shifts: BriefShift[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const row = entry as Record<string, unknown>;

    // A day of work with no day is nothing anyone can roster, and a guessed
    // date is worse than a missing one.
    if (!isRealDate(row.date)) continue;

    const title = text(row.title, 120);
    if (title === "") continue;

    const startTime = time(row.startTime);
    let endTime = time(row.endTime);
    // An end before the start is a misread, not a shift over midnight — a
    // catering day finishes late, but it doesn't start at 18:00 and end at
    // 09:00. Dropping the end keeps the start, which is the useful half.
    if (startTime !== "" && endTime !== "" && endTime <= startTime) endTime = "";

    shifts.push({
      title,
      date: row.date as string,
      startTime,
      endTime,
      location: text(row.location, 120),
      detail: text(row.detail, 500),
      isPrep: row.isPrep === true,
    });

    if (shifts.length >= 30) break;
  }

  // Earliest first, so the list reads as the run-up to the job.
  return shifts.sort((a, b) =>
    a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date),
  );
}

/**
 * The things the planner needs that this brief didn't say.
 *
 * Shown above the proposal, so the gaps are read before the fields that got
 * filled — the opposite of the usual order, and the right one. A confident
 * screen of nine correct fields is exactly where a missing headcount hides.
 */
export function missingFromBrief(brief: Brief): string[] {
  const missing: string[] = [];
  if (brief.guests === null) missing.push("how many people");
  if (brief.eventDate === null) missing.push("the date");
  if (brief.style === null) missing.push("how it's served");
  if (brief.dishes.length === 0) missing.push("the menu");
  return missing;
}

/** Dishes from the brief that aren't in her recipe book yet. */
export function dishesNotInBook(brief: Brief): string[] {
  return brief.dishes.filter((dish) => dish.recipe === null).map((dish) => dish.asWritten);
}

/**
 * Which of her recipes this brief put on the job.
 *
 * Returns ids, matched by name through the same key as the reader used. A
 * recipe named twice in her book resolves to the first — which is the same
 * dish under the same name, so either id orders the same food.
 */
export function recipeIdsFor(
  brief: Brief,
  library: { id?: string; name: string }[],
): string[] {
  const byKey = new Map<string, string>();
  for (const recipe of library) {
    const key = matchKey(recipe.name);
    if (recipe.id && key !== "" && !byKey.has(key)) byKey.set(key, recipe.id);
  }

  const ids: string[] = [];
  for (const dish of brief.dishes) {
    if (dish.recipe === null) continue;
    const id = byKey.get(matchKey(dish.recipe));
    if (id !== undefined && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/**
 * What the brief hands the planner: the saved job's form input.
 *
 * Only what the brief actually stated goes in. Everything else is left out
 * entirely, so the planner's own defaults stand — visible, in boxes she can
 * see — rather than a blank being saved as a decision.
 *
 * With two exceptions, both found on the first real brief she read in.
 *
 * **Proteins are always saved empty.** The planner's blank form ticks brisket
 * and chicken thigh, so leaving them out meant a wedding brief that never
 * mentioned brisket opened with 105 serves of it queued on top of the menu.
 * The brief's food arrives as dishes; a generic protein line is something she
 * ticks on purpose or not at all.
 *
 * **What the planner has no box for rides along in `fromBrief`.** The dishes
 * that aren't in her recipe book yet and the dietaries outside the form's five
 * labels. On that first brief none of the menu was in the book, so the job
 * opened with no dishes and no sign there had ever been a menu — which reads
 * as the brief having been lost, and would have been ordered as if it had.
 * The planner shows these above the form until they're dealt with.
 */
export function jobInputFor(brief: Brief, recipeIds: string[]): Record<string, unknown> {
  const notInBook = dishesNotInBook(brief);
  return {
    recipeIds,
    proteins: [],
    ...(brief.guests !== null ? { guests: brief.guests } : {}),
    ...(brief.eventDate !== null ? { eventDate: brief.eventDate } : {}),
    ...(brief.style !== null ? { style: brief.style } : {}),
    ...(brief.menuWeight !== null ? { menuWeight: brief.menuWeight } : {}),
    ...(brief.serviceWindowHours !== null
      ? { serviceWindowHours: brief.serviceWindowHours }
      : {}),
    ...(brief.budget !== null ? { budget: String(brief.budget) } : {}),
    ...(brief.drinksService !== null ? { drinksService: brief.drinksService } : {}),
    ...(brief.hotOrOutdoors !== null ? { hotOrOutdoors: brief.hotOrOutdoors } : {}),
    ...(brief.dietaries.some((diet) => diet.count > 0)
      ? {
          dietaries: Object.fromEntries(
            brief.dietaries.filter((diet) => diet.count > 0).map((d) => [d.label, d.count]),
          ),
        }
      : {}),
    ...(notInBook.length > 0 || brief.otherDietaries.length > 0
      ? { fromBrief: { dishesNotInBook: notInBook, otherDietaries: brief.otherDietaries } }
      : {}),
  };
}

/** When a shift runs, in words, for a list. "no time given" when the brief didn't say. */
export function shiftWhen(shift: BriefShift): string {
  if (shift.startTime === "" && shift.endTime === "") return "no time given";
  if (shift.endTime === "") return `from ${shift.startTime}`;
  if (shift.startTime === "") return `until ${shift.endTime}`;
  return `${shift.startTime}–${shift.endTime}`;
}

/**
 * What a created shift's note will say.
 *
 * Two things get written in here that have nowhere else to go.
 *
 * The **times**, because a shift's start and finish are stored per rostered
 * person rather than on the shift itself. Until each crew member has their own
 * hours set, the brief's times would otherwise be read once and dropped.
 *
 * The **allergies the planner form has no box for** — a shellfish allergy, low
 * FODMAP, a named ingredient somebody can't eat. The shift note is what the
 * crew read on the day, which is the right place for it, and there is no
 * version of this feature where a requirement the reader found is allowed to
 * vanish between the brief and the bench. They go on on-site shifts only: a
 * prep day in her own kitchen is not where a guest's allergy is acted on, and
 * repeating it on every row is how a note stops being read.
 *
 * The order of the three is not cosmetic. A shift note is capped at 500
 * characters by the shifts table, so something has to give when a brief is
 * wordy — and it must be the description, never the allergy. So the short,
 * load-bearing parts go first and the free text last, where the cut lands.
 */
export function shiftDetail(shift: BriefShift, otherDietaries: string[]): string {
  const parts: string[] = [];
  if (shift.startTime !== "" || shift.endTime !== "") parts.push(shiftWhen(shift));
  if (!shift.isPrep && otherDietaries.length > 0) {
    parts.push(`Allergies and dietaries: ${otherDietaries.join("; ")}`);
  }
  if (shift.detail !== "") parts.push(shift.detail);
  return parts.join(" — ").slice(0, MAX_SHIFT_NOTE);
}

/** What the shifts table stores in a note. Kept in step with the shifts route. */
const MAX_SHIFT_NOTE = 500;

/**
 * What the confirm button says it will make.
 *
 * It names the job, the dishes and the days rather than saying "Confirm". This
 * press writes rows to three tables, and a button that named none of them would
 * be asking her to trust a screen she has read once.
 */
export function whatGetsMade(dishes: number, shifts: number): string {
  const parts = ["the job"];
  if (dishes > 0) parts.push(`${dishes} ${dishes === 1 ? "dish" : "dishes"}`);
  if (shifts > 0) parts.push(`${shifts} ${shifts === 1 ? "day" : "days"} of work`);
  if (parts.length === 1) return "Save the job";
  const last = parts.pop();
  return `Save ${parts.join(", ")} and ${last}`;
}

/**
 * A name for the saved job.
 *
 * Whatever the brief called it, else the client and the date, else something
 * that at least says where it came from. Never empty: the jobs API rejects a
 * blank title, and an operator who has just confirmed a whole proposal should
 * not be handed a validation error about a field the brief never had.
 */
export function jobTitleFor(brief: Brief): string {
  if (brief.title !== "") return brief.title.slice(0, 200);

  const parts = [brief.client, brief.venue].filter((part) => part !== "");
  const who = parts.join(" — ");
  if (who !== "" && brief.eventDate !== null) return `${who}, ${brief.eventDate}`;
  if (who !== "") return who;
  if (brief.eventDate !== null) return `Job from a brief, ${brief.eventDate}`;
  return "Job from a brief";
}
