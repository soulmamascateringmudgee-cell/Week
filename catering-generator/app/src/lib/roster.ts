/**
 * The arithmetic of a roster: who answered, who's on, and how long they were
 * there.
 *
 * Kept away from the pages and the routes because these are the bits that
 * have to be right. A tally that counts someone twice, or hours that come out
 * an hour short across a shift that runs past midnight, is money and goodwill.
 */

export type Answer = "yes" | "no";

export interface Reply {
  staffId: string;
  answer: Answer;
  note?: string | null;
}

export interface Tally {
  yes: number;
  no: number;
  waiting: number;
}

/**
 * Three numbers for a shift: yes, no, and not answered.
 *
 * `waiting` counts people who were asked and haven't said, so it can't be
 * derived from the replies alone — the whole point of the number is the
 * people who aren't in that list. An inactive staff member is not waiting;
 * they've left.
 */
export function tally(asked: { id: string; active: boolean }[], replies: Reply[]): Tally {
  const active = asked.filter((person) => person.active);
  const byId = new Map(replies.map((reply) => [reply.staffId, reply.answer]));
  let yes = 0;
  let no = 0;
  for (const person of active) {
    const answer = byId.get(person.id);
    if (answer === "yes") yes += 1;
    else if (answer === "no") no += 1;
  }
  return { yes, no, waiting: active.length - yes - no };
}

/**
 * Minutes between two clock times, less any break.
 *
 * A shift that starts at 17:00 and ends at 01:30 is eight and a half hours,
 * not minus fifteen and a half. Catering finishes after midnight often
 * enough that treating the smaller number as "the next day" is right far
 * more often than it's wrong — and a shift longer than 18 hours is a typo,
 * so that's where the benefit of the doubt stops.
 */
export function minutesWorked(
  start: string | null | undefined,
  end: string | null | undefined,
  breakMinutes = 0,
): number | null {
  const from = clockMinutes(start);
  const to = clockMinutes(end);
  if (from === null || to === null) return null;
  let span = to - from;
  if (span < 0) span += 24 * 60;
  if (span === 0) return null;
  if (span > 18 * 60) return null;
  const net = span - Math.max(0, Math.round(breakMinutes));
  return net > 0 ? net : null;
}

function clockMinutes(value: string | null | undefined): number | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * "7h 30m". Never "7.5h" — a decimal hour on a timesheet is an argument
 * waiting to happen, and nobody works 7.5 hours, they work half past.
 */
export function asHours(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return "—";
  const whole = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (whole === 0) return `${rest}m`;
  if (rest === 0) return `${whole}h`;
  return `${whole}h ${rest}m`;
}

/** Someone who said yes but hasn't been put on. The gap that loses people. */
export function willingButNotOn(
  replies: Reply[],
  rostered: { staffId: string }[],
): string[] {
  const on = new Set(rostered.map((line) => line.staffId));
  return replies
    .filter((reply) => reply.answer === "yes" && !on.has(reply.staffId))
    .map((reply) => reply.staffId);
}

/** Someone rostered who said no. Worth a second look before the day. */
export function onButSaidNo(
  replies: Reply[],
  rostered: { staffId: string }[],
): string[] {
  const said = new Map(replies.map((reply) => [reply.staffId, reply.answer]));
  return rostered
    .filter((line) => said.get(line.staffId) === "no")
    .map((line) => line.staffId);
}

/**
 * Shifts in the order a cook reads them: soonest first, and today's before
 * anything else. Past shifts come back separately rather than mixed in —
 * a list that opens on last month's Christmas party is a list nobody scrolls.
 */
export function splitByDate<T extends { work_date: string }>(
  shifts: T[],
  today: string,
): { upcoming: T[]; past: T[] } {
  const sorted = [...shifts].sort((a, b) => a.work_date.localeCompare(b.work_date));
  return {
    upcoming: sorted.filter((shift) => shift.work_date >= today),
    past: sorted.filter((shift) => shift.work_date < today).reverse(),
  };
}
