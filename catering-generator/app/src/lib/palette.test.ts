import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { BRANDS } from "./brand.ts";

/**
 * A palette either covers the app or it doesn't.
 *
 * Every colour in this app is a token, so an alternative palette is a block
 * of overrides. The failure mode is quiet: miss one token and that one thing
 * keeps the default value — a white header over a charcoal page, cream text
 * printed on white paper — and nobody notices until it's on a phone in a
 * kitchen or a sheet coming out of a printer.
 *
 * So rather than eyeballing screenshots, this reads the stylesheet: every
 * colour token the default defines, every palette has to answer for.
 */

const CSS = readFileSync(
  fileURLToPath(new URL("../app/globals.css", import.meta.url)),
  "utf8",
);

/** The declarations inside the first `{ ... }` after a selector. */
function block(selector: string): string {
  const at = CSS.indexOf(selector);
  assert.notEqual(at, -1, `no ${selector} block in globals.css`);
  const open = CSS.indexOf("{", at);
  const close = CSS.indexOf("\n}", open);
  assert.ok(close > open, `${selector} block never closes`);
  return CSS.slice(open, close);
}

function tokensIn(selector: string): Set<string> {
  const names = new Set<string>();
  for (const [, name] of block(selector).matchAll(/(--[a-z0-9-]+)\s*:/g)) {
    names.add(name);
  }
  return names;
}

/**
 * Tokens that carry no colour. A palette has no business restating the
 * corner radius or the typeface, so they're not expected in an override.
 */
const NOT_COLOUR = /^--(radius|font)/;

function colourTokens(selector: string): string[] {
  return [...tokensIn(selector)].filter((name) => !NOT_COLOUR.test(name)).sort();
}

test("the default palette defines the tokens we think it does", () => {
  const base = colourTokens(":root {");
  // A sanity floor: if this ever collapses to a handful, the block-finder
  // has broken and every test below would pass on an empty set.
  assert.ok(base.length > 25, `only found ${base.length} colour tokens`);
  for (const expected of ["--ink", "--paper", "--primary", "--on-primary", "--field"]) {
    assert.ok(base.includes(expected), `missing ${expected}`);
  }
});

for (const brand of BRANDS) {
  test(`the ${brand.key} palette covers every colour`, () => {
    const base = colourTokens(":root {");
    const theirs = tokensIn(`html[data-brand="${brand.key}"]`);
    const missed = base.filter((name) => !theirs.has(name));
    assert.deepEqual(
      missed,
      [],
      `${brand.key} leaves these at the default: ${missed.join(", ")}`,
    );
  });

  test(`the ${brand.key} palette invents no token of its own`, () => {
    // An override nothing reads is dead weight, and usually a typo for a
    // token that is therefore still at its default.
    const base = new Set(colourTokens(":root {"));
    const extra = [...tokensIn(`html[data-brand="${brand.key}"]`)].filter(
      (name) => !base.has(name) && !NOT_COLOUR.test(name),
    );
    assert.deepEqual(extra, [], `${brand.key} sets unknown: ${extra.join(", ")}`);
  });
}

test("print puts every palette back to ink on paper", () => {
  // The sheets get printed and worked from. A palette whose --ink is cream
  // would print a blank page, so the print block restates the defaults for
  // any branded page — and has to restate all of them.
  const base = colourTokens(":root {");
  const printed = tokensIn("html[data-brand] {");
  const missed = base.filter((name) => !printed.has(name));
  assert.deepEqual(
    missed,
    [],
    `these keep their screen value when printed: ${missed.join(", ")}`,
  );
});

test("nothing outside a palette block names a colour directly", () => {
  // The whole scheme rests on this: if a rule hardcodes a colour, no palette
  // can reach it. Print is exempt — it is deliberately black on white.
  const screen = CSS.slice(0, CSS.indexOf("@media print {"));
  const afterTokens = screen.slice(screen.indexOf("html[data-brand=\"soul-mamas\"]"));
  const body = afterTokens.slice(afterTokens.indexOf("\n}"));
  const literals = [
    ...body.matchAll(/(?<!var\(|-)(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\))/g),
  ]
    .map((m) => m[0])
    // Comments explain colour choices by quoting hexes; they style nothing.
    .filter((hit) => {
      const at = body.indexOf(hit);
      const line = body.lastIndexOf("\n", at);
      const text = body.slice(line, at);
      return !text.includes("*") && !text.includes("//");
    });
  assert.deepEqual(literals, [], `hardcoded: ${literals.join(", ")}`);
});
