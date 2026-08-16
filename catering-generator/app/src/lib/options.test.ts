import assert from "node:assert/strict";
import { test } from "node:test";

import {
  PROTEIN_CHOICES,
  SHELF_LIFE_CHOICES,
  VENUE_CHOICES,
  WEEKDAY_CHOICES,
  DISCLAIMER_TEXT,
} from "./options.ts";
import {
  DISCLAIMER,
  PROTEINS,
  SAFETY_PCT,
  VENUE_LABEL,
} from "./tables.ts";
import { WEEKDAYS } from "./types.ts";

// The form lists are duplicated on purpose so the browser bundle never sees
// the yield tables. These tests are what stops the two drifting apart.

test("every protein in the engine appears in the form, with the same label", () => {
  assert.equal(PROTEIN_CHOICES.length, PROTEINS.length);
  for (const p of PROTEINS) {
    const choice = PROTEIN_CHOICES.find((c) => c.key === p.key);
    assert.ok(choice, `"${p.key}" is missing from PROTEIN_CHOICES`);
    assert.equal(choice.label, p.label);
  }
});

test("venue choices match the engine's venue types", () => {
  const engineKeys = Object.keys(VENUE_LABEL).sort();
  const formKeys = VENUE_CHOICES.map((c) => c.key).sort();
  assert.deepEqual(formKeys, engineKeys);
  for (const c of VENUE_CHOICES) {
    assert.equal(c.label, VENUE_LABEL[c.key]);
  }
});

test("shelf-life bands match", () => {
  const engineKeys = Object.keys(SAFETY_PCT).sort();
  const formKeys = SHELF_LIFE_CHOICES.map((c) => c.key).sort();
  assert.deepEqual(formKeys, engineKeys);
});

test("weekdays match and start on Monday", () => {
  assert.deepEqual([...WEEKDAY_CHOICES], WEEKDAYS);
});

test("the disclaimer is worded identically in both places", () => {
  assert.equal(DISCLAIMER_TEXT, DISCLAIMER);
});
