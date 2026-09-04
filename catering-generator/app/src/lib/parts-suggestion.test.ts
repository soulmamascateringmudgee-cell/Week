import assert from "node:assert/strict";
import { test } from "node:test";

import { checkParts, collectItems, partsPrompt } from "./parts-suggestion.ts";

// --- What goes out ----------------------------------------------------------

test("only the names are sent, never the amounts", () => {
  // The question is which bowl a line goes in, and a number can't help answer
  // it. Not sending them is also the cheapest guarantee none comes back changed.
  const items = collectItems([
    { item: "Plain flour", qty: 125, unit: "g" },
    { item: "Brown sugar", qty: 0.5, unit: "cup" },
  ]);
  assert.deepEqual(items, ["Plain flour", "Brown sugar"]);

  const prompt = partsPrompt("Apple Crumble", "Crumble topping – mix it.", items!);
  assert.doesNotMatch(prompt, /125/);
  assert.doesNotMatch(prompt, /0\.5/);
});

test("plain strings are accepted too", () => {
  assert.deepEqual(collectItems(["Flour", " Butter "]), ["Flour", "Butter"]);
});

test("a malformed list is refused rather than half-read", () => {
  assert.equal(collectItems("not a list"), null);
  assert.equal(collectItems([{ qty: 1 }]), null, "a row with no name");
  assert.equal(collectItems([{ item: "   " }]), null, "a blank name");
  assert.equal(collectItems([{ item: "Flour" }, null]), null);
});

test("the ingredients are numbered, because the answer is positional", () => {
  const prompt = partsPrompt("X", "M", ["Flour", "Sugar", "Butter"]);
  assert.match(prompt, /1\. Flour/);
  assert.match(prompt, /2\. Sugar/);
  assert.match(prompt, /3\. Butter/);
  assert.match(prompt, /Return 3 parts/);
});

// --- What comes back --------------------------------------------------------

test("a reply that doesn't line up is thrown away whole", () => {
  // This is the one that matters. Applied positionally, a short reply slides
  // every heading up a line and files the topping's flour under the filling —
  // wrong, invisible, and as confident-looking as a right answer.
  assert.equal(checkParts(["Filling", "Filling"], 3), null, "too short");
  assert.equal(checkParts(["A", "B", "C", "D"], 3), null, "too long");
  assert.equal(checkParts(["A", 2, "C"], 3), null, "not all strings");
  assert.equal(checkParts("Filling", 1), null, "not a list");
  assert.equal(checkParts(null, 1), null);
});

test("an exact-length reply is kept, tidied", () => {
  assert.deepEqual(
    checkParts(["  Apple   filling ", "Crumble topping"], 2),
    ["Apple filling", "Crumble topping"],
  );
});

test("blanks are a real answer and survive", () => {
  // "This line isn't in any part" is what an honest reply says about most of
  // the book. Dropping blanks would leave the list short and fail the check.
  assert.deepEqual(checkParts(["", "Dressing", ""], 3), ["", "Dressing", ""]);
});

test("a sentence is cut to a heading's length", () => {
  const long = "For the crumble topping that goes over the apples once they are in the dish and tossed";
  const [part] = checkParts([long], 1)!;
  assert.equal(part.length, 60);
});

test("the two lots of flour keep their own parts", () => {
  // The whole point: the same ingredient twice, filed differently.
  const items = collectItems([
    { item: "Plain flour" },
    { item: "White sugar" },
    { item: "Rolled oats" },
    { item: "Plain flour" },
  ])!;
  const parts = checkParts(
    ["Apple filling", "Apple filling", "Crumble topping", "Crumble topping"],
    items.length,
  )!;
  assert.deepEqual(
    items.map((item, n) => `${parts[n]}: ${item}`),
    [
      "Apple filling: Plain flour",
      "Apple filling: White sugar",
      "Crumble topping: Rolled oats",
      "Crumble topping: Plain flour",
    ],
  );
});
