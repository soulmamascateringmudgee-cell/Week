import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MAX_PAGES,
  collectPages,
  decodedBytes,
  faultInPages,
  pageLabel,
} from "./pages.ts";

/** Base64 of roughly `bytes` bytes, for the size checks. */
function payload(bytes: number): string {
  return "A".repeat(Math.ceil((bytes * 4) / 3));
}

const jpegOnly = (mediaType: string) => mediaType === "image/jpeg";

test("reads a list of pages", () => {
  const pages = collectPages({
    pages: [
      { mediaType: "image/jpeg", data: "aaa" },
      { mediaType: "image/png", data: "bbb" },
    ],
  });
  assert.equal(pages.length, 2);
  assert.equal(pages[1].mediaType, "image/png");
});

test("still reads the single-photo shape every caller used before", () => {
  // A page saved to a phone's home screen keeps running its old script until
  // it reloads, so this shape outlives the deploy that stopped sending it.
  const pages = collectPages({ mediaType: "image/jpeg", data: "aaa" });
  assert.deepEqual(pages, [{ mediaType: "image/jpeg", data: "aaa" }]);
});

test("drops entries with nothing in them", () => {
  const pages = collectPages({
    pages: [
      { mediaType: "image/jpeg", data: "aaa" },
      { mediaType: "image/jpeg", data: "" },
      { mediaType: "", data: "bbb" },
      null,
      "nonsense",
    ],
  });
  assert.deepEqual(pages, [{ mediaType: "image/jpeg", data: "aaa" }]);
});

test("a body that isn't an object has no pages", () => {
  assert.deepEqual(collectPages(null), []);
  assert.deepEqual(collectPages("receipt"), []);
});

test("no pages is a fault", () => {
  const fault = faultInPages([], { isAllowedType: jpegOnly, maxBytes: 100 });
  assert.deepEqual(fault, { kind: "empty" });
});

test("too many pages is a fault, and names the count", () => {
  const many = Array.from({ length: MAX_PAGES + 1 }, () => ({
    mediaType: "image/jpeg",
    data: "aaa",
  }));
  const fault = faultInPages(many, { isAllowedType: jpegOnly, maxBytes: 1e9 });
  assert.deepEqual(fault, { kind: "too-many", count: MAX_PAGES + 1 });
});

test("exactly the limit is allowed", () => {
  const some = Array.from({ length: MAX_PAGES }, () => ({
    mediaType: "image/jpeg",
    data: "aaa",
  }));
  assert.equal(faultInPages(some, { isAllowedType: jpegOnly, maxBytes: 1e9 }), null);
});

test("one page of the wrong type fails the whole set", () => {
  const fault = faultInPages(
    [
      { mediaType: "image/jpeg", data: "aaa" },
      { mediaType: "image/heic", data: "bbb" },
    ],
    { isAllowedType: jpegOnly, maxBytes: 1e9 },
  );
  assert.deepEqual(fault, { kind: "type", mediaType: "image/heic" });
});

test("the size cap is on the total, not on each page", () => {
  // Three pages that each fit comfortably, but together do not. Checking them
  // one at a time would wave this through and the request would fail further
  // in, where the message means nothing to a cook.
  const pages = [
    { mediaType: "image/jpeg", data: payload(400) },
    { mediaType: "image/jpeg", data: payload(400) },
    { mediaType: "image/jpeg", data: payload(400) },
  ];
  assert.equal(faultInPages(pages, { isAllowedType: jpegOnly, maxBytes: 2000 }), null);

  const fault = faultInPages(pages, { isAllowedType: jpegOnly, maxBytes: 1000 });
  assert.equal(fault?.kind, "too-big");
});

test("decoded bytes tracks the real size", () => {
  assert.equal(decodedBytes(payload(3000)), 3000);
});

test("a single photo isn't labelled, several are", () => {
  assert.equal(pageLabel(0, 1), "");
  assert.equal(pageLabel(0, 3), "Photo 1 of 3:");
  assert.equal(pageLabel(2, 3), "Photo 3 of 3:");
});
