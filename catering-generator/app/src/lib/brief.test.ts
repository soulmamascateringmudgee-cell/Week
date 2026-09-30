import assert from "node:assert/strict";
import { test } from "node:test";

import {
  blankBrief,
  dishesNotInBook,
  isRealDate,
  jobInputFor,
  jobTitleFor,
  missingFromBrief,
  readBrief,
  recipeIdsFor,
  shiftDetail,
  shiftWhen,
  whatGetsMade,
} from "./brief.ts";

const BOOK = [
  "Slow cooked beef brisket",
  "Charred broccolini with almonds",
  "Apple crumble",
];

/**
 * A reader that fills in the blanks is worse than no reader: the blanks are
 * where the headcount goes. Every one of these asserts that something absent
 * stays absent.
 */
test("a field the brief didn't state comes back null, not a default", () => {
  const brief = readBrief({}, BOOK);

  assert.equal(brief.guests, null);
  assert.equal(brief.eventDate, null);
  assert.equal(brief.style, null);
  assert.equal(brief.menuWeight, null);
  assert.equal(brief.budget, null);
  assert.equal(brief.serviceWindowHours, null);
  assert.equal(brief.crewNeeded, null);
  assert.deepEqual(brief.dishes, []);
  assert.deepEqual(brief.shifts, []);
});

test("an unstated yes/no is null, not no", () => {
  // The distinction the whole feature rests on: a brief silent about drinks
  // is not a brief that said no drinks.
  const silent = readBrief({}, BOOK);
  assert.equal(silent.drinksService, null);
  assert.equal(silent.hotOrOutdoors, null);

  const said = readBrief({ drinksService: "no", hotOrOutdoors: "yes" }, BOOK);
  assert.equal(said.drinksService, false);
  assert.equal(said.hotOrOutdoors, true);

  // The schema's sentinel, and anything unexpected, both read as unstated.
  const sentinel = readBrief({ drinksService: "", hotOrOutdoors: "maybe" }, BOOK);
  assert.equal(sentinel.drinksService, null);
  assert.equal(sentinel.hotOrOutdoors, null);
});

test("zero reads as unstated for the numbers that can't be zero", () => {
  const brief = readBrief({ guests: 0, budget: 0, serviceWindowHours: 0 }, BOOK);
  assert.equal(brief.guests, null);
  assert.equal(brief.budget, null);
  assert.equal(brief.serviceWindowHours, null);
});

test("a style or menu weight the form doesn't offer is dropped", () => {
  const brief = readBrief({ style: "buffet", menuWeight: "enormous" }, BOOK);
  assert.equal(brief.style, null);
  assert.equal(brief.menuWeight, null);

  const good = readBrief({ style: "grazing", menuWeight: "feasting" }, BOOK);
  assert.equal(good.style, "grazing");
  assert.equal(good.menuWeight, "feasting");
});

test("a date that isn't a real day is refused", () => {
  assert.equal(isRealDate("2026-02-30"), false);
  assert.equal(isRealDate("2026-13-01"), false);
  assert.equal(isRealDate("14/03/2026"), false);
  assert.equal(isRealDate("2026-03-14"), true);

  assert.equal(readBrief({ eventDate: "2026-02-30" }, BOOK).eventDate, null);
  assert.equal(readBrief({ eventDate: "2026-03-14" }, BOOK).eventDate, "2026-03-14");
});

// ------------------------------------------------------------------- dishes

test("a dish is matched to her recipe by name, ignoring case and punctuation", () => {
  const brief = readBrief(
    {
      dishes: [
        { asWritten: "the brisket", recipe: "slow-cooked BEEF brisket" },
        { asWritten: "Apple Crumble", recipe: "" },
      ],
    },
    BOOK,
  );

  assert.equal(brief.dishes[0].recipe, "Slow cooked beef brisket");
  // No claimed match, but the dish's own name is one of hers.
  assert.equal(brief.dishes[1].recipe, "Apple crumble");
});

test("a claimed match that isn't in her book is discarded, and the dish kept", () => {
  // This is the invention guard. A model naming a recipe she doesn't have
  // would otherwise put food on a job that nothing has costed.
  const brief = readBrief(
    { dishes: [{ asWritten: "Lamb shoulder, 8 hours", recipe: "Slow cooked lamb shoulder" }] },
    BOOK,
  );

  assert.equal(brief.dishes.length, 1);
  assert.equal(brief.dishes[0].asWritten, "Lamb shoulder, 8 hours");
  assert.equal(brief.dishes[0].recipe, null);
  assert.deepEqual(dishesNotInBook(brief), ["Lamb shoulder, 8 hours"]);
});

test("the same dish written twice is one dish", () => {
  const brief = readBrief(
    {
      dishes: [
        { asWritten: "Apple crumble", recipe: "Apple crumble" },
        { asWritten: "apple  crumble!", recipe: "Apple crumble" },
      ],
    },
    BOOK,
  );
  assert.equal(brief.dishes.length, 1);
});

test("matched dishes become recipe ids, unmatched ones don't", () => {
  const library = [
    { id: "r1", name: "Slow cooked beef brisket" },
    { id: "r2", name: "Apple crumble" },
    { id: "r3", name: "Charred broccolini with almonds" },
  ];
  const brief = readBrief(
    {
      dishes: [
        { asWritten: "brisket", recipe: "Slow cooked beef brisket" },
        { asWritten: "Something she's never made", recipe: "" },
        { asWritten: "Apple crumble", recipe: "Apple crumble" },
      ],
    },
    BOOK,
  );

  assert.deepEqual(recipeIdsFor(brief, library), ["r1", "r2"]);
});

// ---------------------------------------------------------------- dietaries

test("a dietary the form can hold is counted; one it can't is kept verbatim", () => {
  const brief = readBrief(
    {
      dietaries: [
        { label: "Gluten free", count: 2 },
        { label: "Gluten free", count: 1 },
        { label: "Vegan", count: 0 },
        { label: "Coeliac", count: 3 },
      ],
      otherDietaries: ["1 × shellfish allergy", "1 × shellfish allergy", "low FODMAP"],
    },
    BOOK,
  );

  // Two lines naming the same requirement are that many people.
  assert.deepEqual(brief.dietaries, [
    { label: "Gluten free", count: 3 },
    { label: "Vegan", count: 0 },
  ]);
  // "Coeliac" isn't one of the form's labels, so it is not silently mapped
  // onto one — it would have to arrive through otherDietaries to be seen.
  assert.deepEqual(brief.otherDietaries, ["1 × shellfish allergy", "low FODMAP"]);
});

// ------------------------------------------------------------------- shifts

test("a shift without a real date or a name is dropped", () => {
  const brief = readBrief(
    {
      shifts: [
        { title: "Prep day", date: "not a date" },
        { title: "", date: "2026-03-13" },
        { title: "Service", date: "2026-03-14" },
      ],
    },
    BOOK,
  );

  assert.equal(brief.shifts.length, 1);
  assert.equal(brief.shifts[0].title, "Service");
});

test("shifts come back earliest first", () => {
  const brief = readBrief(
    {
      shifts: [
        { title: "Service", date: "2026-03-14", startTime: "16:00" },
        { title: "Bump in", date: "2026-03-14", startTime: "09:30" },
        { title: "Prep", date: "2026-03-12", isPrep: true },
      ],
    },
    BOOK,
  );

  assert.deepEqual(
    brief.shifts.map((shift) => `${shift.date} ${shift.startTime}`),
    ["2026-03-12 ", "2026-03-14 09:30", "2026-03-14 16:00"],
  );
  assert.equal(brief.shifts[0].isPrep, true);
  assert.equal(brief.shifts[1].isPrep, false);
});

test("a time that isn't a 24-hour clock time is dropped, not reinterpreted", () => {
  const brief = readBrief(
    {
      shifts: [
        { title: "Service", date: "2026-03-14", startTime: "4:30pm", endTime: "23:00" },
        { title: "Prep", date: "2026-03-13", startTime: "25:00", endTime: "9am" },
      ],
    },
    BOOK,
  );

  const service = brief.shifts.find((shift) => shift.title === "Service");
  assert.equal(service?.startTime, "");
  assert.equal(service?.endTime, "23:00");

  const prep = brief.shifts.find((shift) => shift.title === "Prep");
  assert.equal(prep?.startTime, "");
  assert.equal(prep?.endTime, "");
});

test("an end time before the start is dropped rather than kept as a long shift", () => {
  const brief = readBrief(
    { shifts: [{ title: "Service", date: "2026-03-14", startTime: "18:00", endTime: "09:00" }] },
    BOOK,
  );
  assert.equal(brief.shifts[0].startTime, "18:00");
  assert.equal(brief.shifts[0].endTime, "");
});

// ------------------------------------------------------------- what's missing

test("the gaps are reported, and go away as they're filled", () => {
  assert.deepEqual(missingFromBrief(blankBrief()), [
    "how many people",
    "the date",
    "how it's served",
    "the menu",
  ]);

  const full = readBrief(
    {
      guests: 80,
      eventDate: "2026-03-14",
      style: "shared",
      dishes: [{ asWritten: "Apple crumble", recipe: "Apple crumble" }],
    },
    BOOK,
  );
  assert.deepEqual(missingFromBrief(full), []);
});

// ------------------------------------------------------------------- the title

test("the job always gets a name, whatever the brief left out", () => {
  assert.equal(jobTitleFor(blankBrief()), "Job from a brief");

  assert.equal(
    jobTitleFor(readBrief({ title: "Taylor wedding, Burnbrae" }, BOOK)),
    "Taylor wedding, Burnbrae",
  );
  assert.equal(
    jobTitleFor(readBrief({ client: "Taylor", eventDate: "2026-03-14" }, BOOK)),
    "Taylor, 2026-03-14",
  );
  assert.equal(
    jobTitleFor(readBrief({ client: "Taylor", venue: "Burnbrae" }, BOOK)),
    "Taylor — Burnbrae",
  );
  assert.equal(
    jobTitleFor(readBrief({ eventDate: "2026-03-14" }, BOOK)),
    "Job from a brief, 2026-03-14",
  );
});

// --------------------------------------------------- what reaches the crew

const SHIFT = {
  title: "Service",
  date: "2026-03-14",
  startTime: "16:00",
  endTime: "23:00",
  location: "Burnbrae",
  detail: "Long table in the shed",
  isPrep: false,
};

test("times are written into the shift note, since a shift has nowhere else for them", () => {
  assert.equal(shiftWhen(SHIFT), "16:00–23:00");
  assert.equal(shiftWhen({ ...SHIFT, endTime: "" }), "from 16:00");
  assert.equal(shiftWhen({ ...SHIFT, startTime: "" }), "until 23:00");
  assert.equal(shiftWhen({ ...SHIFT, startTime: "", endTime: "" }), "no time given");

  assert.equal(shiftDetail(SHIFT, []), "16:00–23:00 — Long table in the shed");
  assert.equal(
    shiftDetail(SHIFT, ["1 × shellfish allergy"]),
    "16:00–23:00 — Allergies and dietaries: 1 × shellfish allergy — Long table in the shed",
  );
  assert.equal(
    shiftDetail({ ...SHIFT, startTime: "", endTime: "" }, []),
    "Long table in the shed",
  );
});

test("an allergy the form can't hold reaches the on-site crew and doesn't vanish", () => {
  // The requirement the whole otherDietaries path exists for. If this note
  // doesn't carry it, a requirement the reader found is lost between the brief
  // and the bench.
  const note = shiftDetail(SHIFT, ["2 × shellfish allergy", "1 × low FODMAP"]);
  assert.match(note, /shellfish allergy/);
  assert.match(note, /low FODMAP/);
  assert.match(note, /Long table in the shed/);
  assert.match(note, /16:00–23:00/);
});

test("a prep day in her own kitchen doesn't repeat the guests' allergies", () => {
  const note = shiftDetail({ ...SHIFT, isPrep: true, title: "Prep" }, ["shellfish allergy"]);
  assert.equal(note.includes("shellfish"), false);
  assert.match(note, /Long table in the shed/);
});

test("a wordy brief loses its description to the length cap, never the allergy", () => {
  // The cap is the shifts table's, so something has to go when a brief runs
  // long. It must be the prose and not the thing that keeps somebody safe.
  const long = shiftDetail({ ...SHIFT, detail: "x".repeat(900) }, ["2 × shellfish allergy"]);

  assert.ok(long.length <= 500, `note was ${long.length} characters`);
  assert.match(long, /16:00–23:00/);
  assert.match(long, /2 × shellfish allergy/);
  // The description is what got cut.
  assert.ok(long.endsWith("x"), "expected the prose to be the truncated part");
});

test("the button names what it will make", () => {
  assert.equal(whatGetsMade(0, 0), "Save the job");
  assert.equal(whatGetsMade(1, 0), "Save the job and 1 dish");
  assert.equal(whatGetsMade(0, 1), "Save the job and 1 day of work");
  assert.equal(whatGetsMade(6, 3), "Save the job, 6 dishes and 3 days of work");
});

test("rubbish in gives a blank brief out, not a crash", () => {
  for (const rubbish of [null, undefined, "", 7, [], { dishes: "lots" }, { shifts: 3 }]) {
    const brief = readBrief(rubbish, BOOK);
    assert.deepEqual(brief.dishes, []);
    assert.deepEqual(brief.shifts, []);
    assert.equal(brief.guests, null);
  }
});

/**
 * Both of these came off the first real brief read in — a 105-guest wedding
 * whose menu wasn't in the recipe book yet. The job opened with no food on it,
 * no sign there had been a menu, and brisket and chicken thigh ticked because
 * that's what a blank planner starts with.
 */
test("a job from a brief never inherits the planner's default proteins", () => {
  const brief = readBrief({ guests: 105, dishes: [{ asWritten: "Roast topside" }] }, BOOK);
  assert.deepEqual(jobInputFor(brief, []).proteins, []);
});

test("dishes not in the book and unboxed dietaries reach the planner", () => {
  const brief = readBrief(
    {
      guests: 105,
      dishes: [
        { asWritten: "Roast topside with jus" },
        { asWritten: "Apple crumble", recipe: "Apple crumble" },
      ],
      otherDietaries: ["1 pescatarian", "coeliac"],
    },
    BOOK,
  );
  const input = jobInputFor(brief, ["crumble-id"]);
  assert.deepEqual(input.recipeIds, ["crumble-id"]);
  assert.deepEqual(input.fromBrief, {
    dishesNotInBook: ["Roast topside with jus"],
    otherDietaries: ["1 pescatarian", "coeliac"],
  });
});

test("a brief with nothing left over carries no fromBrief, and unstated fields stay out", () => {
  const brief = readBrief(
    { dishes: [{ asWritten: "Apple crumble", recipe: "Apple crumble" }] },
    BOOK,
  );
  const input = jobInputFor(brief, ["crumble-id"]);
  assert.equal("fromBrief" in input, false);
  assert.equal("guests" in input, false);
  assert.equal("style" in input, false);
});
