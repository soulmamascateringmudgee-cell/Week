import assert from "node:assert/strict";
import { test } from "node:test";

import {
  asHours,
  minutesWorked,
  onButSaidNo,
  splitByDate,
  tally,
  willingButNotOn,
} from "./roster.ts";

const crew = [
  { id: "a", active: true },
  { id: "b", active: true },
  { id: "c", active: true },
  { id: "gone", active: false },
];

// --- Who answered -----------------------------------------------------------

test("the three numbers add up to the people who were asked", () => {
  const counts = tally(crew, [
    { staffId: "a", answer: "yes" },
    { staffId: "b", answer: "no" },
  ]);
  assert.deepEqual(counts, { yes: 1, no: 1, waiting: 1 });
});

test("someone who has left is not still waiting", () => {
  // Otherwise every shift shows an answer outstanding forever, and the
  // number stops meaning "people I'm still waiting on".
  const counts = tally(crew, []);
  assert.equal(counts.waiting, 3);
});

test("a reply from someone no longer on the crew counts for nothing", () => {
  const counts = tally(crew, [{ staffId: "gone", answer: "yes" }]);
  assert.deepEqual(counts, { yes: 0, no: 0, waiting: 3 });
});

test("nobody asked is not nobody waiting", () => {
  assert.deepEqual(tally([], []), { yes: 0, no: 0, waiting: 0 });
});

// --- Hours ------------------------------------------------------------------

test("an ordinary shift", () => {
  assert.equal(minutesWorked("09:00", "17:00"), 480);
});

test("a shift that finishes after midnight is not negative", () => {
  // A wedding that starts at 5pm and finishes at 1:30am is eight and a half
  // hours. Read the other way it is minus fifteen and a half, which would
  // land on a timesheet as nothing at all.
  assert.equal(minutesWorked("17:00", "01:30"), 510);
});

test("the break comes off", () => {
  assert.equal(minutesWorked("09:00", "17:00", 30), 450);
});

test("a break longer than the shift is not negative hours", () => {
  assert.equal(minutesWorked("09:00", "09:30", 45), null);
});

test("a shift longer than eighteen hours is a typo, not a shift", () => {
  // 09:00 to 08:00 reads as 23 hours. Far more likely someone meant 08:00
  // this morning and typed it in the wrong box, and paying 23 hours because
  // the arithmetic allowed it is worse than asking.
  assert.equal(minutesWorked("09:00", "08:00"), null);
});

test("half a time is no time", () => {
  for (const [from, to] of [
    ["09:00", ""],
    ["", "17:00"],
    ["9am", "5pm"],
    ["25:00", "26:00"],
    ["09:60", "17:00"],
  ]) {
    assert.equal(minutesWorked(from, to), null, `${from}–${to}`);
  }
  assert.equal(minutesWorked(null, undefined), null);
});

test("the same time twice is not a whole day", () => {
  assert.equal(minutesWorked("09:00", "09:00"), null);
});

test("hours read the way a person says them", () => {
  assert.equal(asHours(510), "8h 30m");
  assert.equal(asHours(480), "8h");
  assert.equal(asHours(45), "45m");
  assert.equal(asHours(0), "—");
  assert.equal(asHours(null), "—");
});

// --- The gaps that lose people ---------------------------------------------

test("someone who said yes and wasn't put on is findable", () => {
  const said = willingButNotOn(
    [
      { staffId: "a", answer: "yes" },
      { staffId: "b", answer: "yes" },
    ],
    [{ staffId: "a" }],
  );
  assert.deepEqual(said, ["b"]);
});

test("someone rostered who said no is findable", () => {
  const clash = onButSaidNo(
    [{ staffId: "a", answer: "no" }],
    [{ staffId: "a" }, { staffId: "b" }],
  );
  assert.deepEqual(clash, ["a"]);
});

test("nobody rostered who never replied counts as a clash", () => {
  // Not answering is not the same as saying no, and flagging it as one
  // would put a warning on every shift rostered before the replies came in.
  assert.deepEqual(onButSaidNo([], [{ staffId: "a" }]), []);
});

// --- Ordering ---------------------------------------------------------------

test("today is upcoming, yesterday is past", () => {
  const { upcoming, past } = splitByDate(
    [
      { work_date: "2026-10-04" },
      { work_date: "2026-09-29" },
      { work_date: "2026-09-30" },
      { work_date: "2026-10-01" },
    ],
    "2026-09-30",
  );
  assert.deepEqual(upcoming.map((s) => s.work_date), [
    "2026-09-30",
    "2026-10-01",
    "2026-10-04",
  ]);
  assert.deepEqual(past.map((s) => s.work_date), ["2026-09-29"]);
});

test("past shifts read backwards, most recent first", () => {
  const { past } = splitByDate(
    [{ work_date: "2026-08-01" }, { work_date: "2026-09-01" }],
    "2026-09-30",
  );
  assert.deepEqual(past.map((s) => s.work_date), ["2026-09-01", "2026-08-01"]);
});

test("splitting doesn't reorder the caller's array", () => {
  const shifts = [{ work_date: "2026-10-04" }, { work_date: "2026-09-29" }];
  splitByDate(shifts, "2026-09-30");
  assert.deepEqual(shifts.map((s) => s.work_date), ["2026-10-04", "2026-09-29"]);
});
