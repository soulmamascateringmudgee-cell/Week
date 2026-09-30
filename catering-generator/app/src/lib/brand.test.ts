import assert from "node:assert/strict";
import { test } from "node:test";

import { BRANDS, brandKey, brandToStore } from "./brand.ts";

test("a known brand comes back as its key", () => {
  assert.equal(brandKey("soul-mamas"), "soul-mamas");
});

test("case and stray spaces don't lose the brand", () => {
  // The column can be set by hand in Supabase, and " Soul-Mamas " is plainly
  // the same intent as "soul-mamas".
  assert.equal(brandKey(" Soul-Mamas "), "soul-mamas");
});

test("no brand is the plain look, not a broken one", () => {
  for (const stored of [null, undefined, "", "   ", 7, {}, ["soul-mamas"]]) {
    assert.equal(brandKey(stored), null, `${JSON.stringify(stored)}`);
  }
});

test("an unknown brand falls back rather than through", () => {
  // The attribute goes into the markup. A palette this build has never heard
  // of — a hand-typed value, or one a later version added — must land on the
  // default look, not on a page whose colour tokens are never defined.
  assert.equal(brandKey("mamacitas"), null);
  assert.equal(brandKey("soul mamas"), null);
  assert.equal(brandKey("soul-mamas-dark"), null);
});

test("nothing that isn't a real brand can be stored", () => {
  assert.equal(brandToStore("soul-mamas"), "soul-mamas");
  assert.equal(brandToStore("plain"), null);
  assert.equal(brandToStore(""), null);
  assert.equal(brandToStore("<script>"), null);
});

test("every brand in the list has a key the storer accepts", () => {
  // A brand offered in Account that the storer then refuses would be a
  // picker with a dead option on it.
  for (const brand of BRANDS) {
    assert.equal(brandToStore(brand.key), brand.key, brand.key);
    assert.ok(brand.label.length > 0);
    assert.ok(brand.note.length > 0);
  }
});

test("brand keys are safe to write into an attribute", () => {
  for (const brand of BRANDS) {
    assert.match(brand.key, /^[a-z0-9-]+$/, brand.key);
  }
});
