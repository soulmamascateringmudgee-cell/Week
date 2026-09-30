import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MAX_ATTEMPTS,
  crewCodeFrom,
  hashPin,
  isLocked,
  lockFor,
  minutesUntil,
  normaliseCrewCode,
  pinConfirmProblem,
  pinMatches,
  pinProblem,
  newSessionToken,
  hashToken,
  sessionExpiry,
} from "./crew-access.ts";

const NOW = new Date("2026-09-30T09:00:00Z");

// --- PINs -------------------------------------------------------------------

test("a good PIN is four digits", () => {
  assert.equal(pinProblem("8412"), null);
});

test("the rules say what's wrong, not just that something is", () => {
  assert.equal(pinProblem(""), "Type a PIN.");
  assert.equal(pinProblem("12a4"), "Numbers only.");
  assert.equal(pinProblem("123"), "It needs to be 4 digits.");
  assert.equal(pinProblem("12345"), "It needs to be 4 digits.");
  assert.equal(pinProblem(null), "Type a PIN.");
});

test("the PINs everyone tries first are refused", () => {
  for (const pin of ["0000", "1234", "1111", "4321"]) {
    assert.ok(pinProblem(pin), pin);
  }
});

// --- Choosing one for the first time -----------------------------------------

test("both boxes matching is the only way through", () => {
  assert.equal(pinConfirmProblem("8412", "8412"), null);
  assert.equal(pinConfirmProblem("8412", "8413"), "Those two don't match.");
});

test("the second box is not optional", () => {
  // Nobody is standing next to a casual to check they typed it right, and a
  // mistyped PIN is someone locked out of the roster on the morning of a job.
  assert.equal(
    pinConfirmProblem("8412", ""),
    "Type it a second time so we know it's right.",
  );
  assert.equal(
    pinConfirmProblem("8412", undefined),
    "Type it a second time so we know it's right.",
  );
});

test("a bad PIN is reported before the two are compared", () => {
  // "Those two don't match" when the real problem is that it's three digits
  // sends someone off retyping the wrong thing.
  assert.equal(pinConfirmProblem("123", "123"), "It needs to be 4 digits.");
  assert.equal(pinConfirmProblem("1234", "1234"), "Pick something less guessable than that.");
  assert.equal(pinConfirmProblem("", ""), "Type a PIN.");
});

test("stray spaces around a confirmation don't fail it", () => {
  assert.equal(pinConfirmProblem("8412", " 8412 "), null);
});

test("a hash is not the PIN", () => {
  const stored = hashPin("8412");
  assert.ok(!stored.includes("8412"));
  assert.match(stored, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
});

test("the same PIN hashes differently every time", () => {
  // Per-person salt. Without it, two staff who happen to pick the same four
  // digits are visibly the same row, and one leaked PIN is two logins.
  assert.notEqual(hashPin("8412"), hashPin("8412"));
});

test("a PIN matches its own hash and nothing else", () => {
  const stored = hashPin("8412");
  assert.equal(pinMatches("8412", stored), true);
  assert.equal(pinMatches("8413", stored), false);
  assert.equal(pinMatches("", stored), false);
});

test("a missing or mangled hash lets nobody in", () => {
  // Fail closed. A staff row with no PIN set, or a value someone edited by
  // hand, must not become an account that accepts anything.
  for (const stored of [null, undefined, "", "8412", "scrypt$abc", "bcrypt$a$b"]) {
    assert.equal(pinMatches("8412", stored), false, String(stored));
  }
});

test("a hash with an empty key is refused rather than matching everything", () => {
  assert.equal(pinMatches("8412", "scrypt$abcd$"), false);
});

// --- The attempt limit ------------------------------------------------------

test("the lock only comes on at the limit", () => {
  assert.equal(lockFor(MAX_ATTEMPTS - 1, NOW), null);
  assert.ok(lockFor(MAX_ATTEMPTS, NOW) instanceof Date);
});

test("a lock in the past is not a lock", () => {
  assert.equal(isLocked("2026-09-30T08:00:00Z", NOW), false);
  assert.equal(isLocked("2026-09-30T09:10:00Z", NOW), true);
  assert.equal(isLocked(null, NOW), false);
  assert.equal(isLocked("not a date", NOW), false);
});

test("how long to wait is rounded up, never to zero", () => {
  assert.equal(minutesUntil("2026-09-30T09:14:30Z", NOW), 15);
  assert.equal(minutesUntil("2026-09-30T09:00:01Z", NOW), 1);
});

// --- Sessions ---------------------------------------------------------------

test("a session token is long and never repeats", () => {
  const seen = new Set(Array.from({ length: 50 }, () => newSessionToken()));
  assert.equal(seen.size, 50);
  for (const token of seen) assert.ok(token.length >= 40, token);
});

test("only the hash is worth storing", () => {
  const token = newSessionToken();
  const stored = hashToken(token);
  assert.notEqual(stored, token);
  assert.equal(hashToken(token), stored, "the same token always hashes the same");
  assert.notEqual(hashToken(newSessionToken()), stored);
});

test("a session runs out", () => {
  assert.ok(sessionExpiry(NOW) > NOW);
});

// --- The crew URL -----------------------------------------------------------

test("a business name becomes something you can read down the phone", () => {
  assert.equal(crewCodeFrom("Soul Mamas Catering"), "soulmamascatering");
  assert.equal(crewCodeFrom("O'Brien & Sons"), "obriensons");
});

test("a name too short to make a code still gets one", () => {
  // Otherwise an operator with no business name saved has no crew URL at
  // all, and the page 404s with nothing to tell them.
  const code = crewCodeFrom(null);
  assert.ok(code.length >= 3, code);
  assert.match(code, /^[a-z0-9]+$/);
});

test("what's typed into the URL normalises before it's looked up", () => {
  assert.equal(normaliseCrewCode(" SoulMamas "), "soulmamas");
  assert.equal(normaliseCrewCode("soul-mamas"), "soulmamas");
  assert.equal(normaliseCrewCode("ab"), null);
  assert.equal(normaliseCrewCode("x".repeat(40)), null);
  assert.equal(normaliseCrewCode(42), null);
  assert.equal(normaliseCrewCode("../admin"), "admin".length >= 3 ? "admin" : null);
});
