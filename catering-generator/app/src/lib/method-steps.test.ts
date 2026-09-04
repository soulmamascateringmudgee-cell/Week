import assert from "node:assert/strict";
import { test } from "node:test";

import { methodSteps } from "./method-steps.ts";

test("a method breaks where the recipe already broke", () => {
  const steps = methodSteps("Preheat the oven.\nPeel the apples.\nBake 40 min.");
  assert.equal(steps.length, 3);
  assert.deepEqual(
    steps.map((s) => s.text),
    ["Preheat the oven.", "Peel the apples.", "Bake 40 min."],
  );
  assert.deepEqual(steps.map((s) => s.label), [null, null, null]);
});

test("the cook's own label comes out in front", () => {
  // Both shapes the book uses: a dash, and a shouted colon.
  const [dash] = methodSteps("Crumble topping – place the topping in a bowl.");
  assert.equal(dash.label, "Crumble topping");
  assert.equal(dash.text, "place the topping in a bowl.");

  const [colon] = methodSteps("BUTTERSCOTCH SAUCE: sugar, butter and cream.");
  assert.equal(colon.label, "BUTTERSCOTCH SAUCE");
  assert.equal(colon.text, "sugar, butter and cream.");
});

test("a sentence with a dash in it is not a label", () => {
  // The failure that would put half a sentence in bold on every step.
  const [step] = methodSteps(
    "Bake for 30 to 40 minutes — until golden brown and bubbling at the edges.",
  );
  assert.equal(step.label, null);
  assert.match(step.text, /^Bake for 30 to 40 minutes/);
});

test("a numbered step keeps its sentence and loses its numeral", () => {
  // Lifting the digit out as a heading gives a step called "1".
  const steps = methodSteps("1. Marinate the chicken.\n2. Dredge it.\n3) Fry it.");
  assert.deepEqual(
    steps.map((s) => s.text),
    ["Marinate the chicken.", "Dredge it.", "Fry it."],
  );
  assert.deepEqual(steps.map((s) => s.label), [null, null, null]);
});

test("a label with nothing after it stays part of its line", () => {
  // A bold word alone on the page is a heading, not a step.
  const [step] = methodSteps("PREP:");
  assert.equal(step.label, null);
  assert.equal(step.text, "PREP:");
});

test("blank lines don't become empty steps", () => {
  const steps = methodSteps("PREP: chop it.\n\n\nBake it.\n   \n");
  assert.equal(steps.length, 2);
});

test("no method is no steps, not one empty one", () => {
  assert.deepEqual(methodSteps(""), []);
  assert.deepEqual(methodSteps("   \n  "), []);
  assert.deepEqual(methodSteps(null), []);
  assert.deepEqual(methodSteps(undefined), []);
});

test("a method written as one paragraph stays one step", () => {
  // Nothing on the page said where to break it, and inventing a break would
  // put a step boundary in the middle of somebody's sentence.
  const steps = methodSteps(
    "Heat the oven. Line the tin. Cream the butter and sugar until pale.",
  );
  assert.equal(steps.length, 1);
  assert.equal(steps[0].label, null);
});

test("nothing is reworded on the way through", () => {
  const method =
    "PREP: Chop the dates.\nHeat oven 180C. Line the tin.\nMAKE AHEAD: better the next day.";
  const back = methodSteps(method)
    .map((s) => (s.label ? `${s.label}: ${s.text}` : s.text))
    .join("\n");
  assert.equal(back, method);
});
