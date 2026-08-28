import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MIN_PASSWORD,
  looksLikeEmail,
  normaliseEmail,
  passwordProblem,
} from "./signup-rules.ts";

test("a decent passphrase is accepted", () => {
  assert.equal(passwordProblem("brisket friday mudgee"), null);
});

test("short passwords are rejected with the length in the message", () => {
  const problem = passwordProblem("short");
  assert.ok(problem);
  assert.match(problem, new RegExp(String(MIN_PASSWORD)));
});

// bcrypt stops reading at 72 bytes, so accepting a longer one would store a
// password that isn't the one they typed.
test("passwords past the bcrypt limit are rejected", () => {
  assert.ok(passwordProblem("a".repeat(73)));
  assert.equal(passwordProblem("a".repeat(72) + ""), null);
});

test("all-space passwords are rejected even when long enough", () => {
  assert.ok(passwordProblem(" ".repeat(12)));
});

test("obvious passwords are rejected", () => {
  assert.ok(passwordProblem("password123"));
  assert.ok(passwordProblem("PASSWORD123"));
});

test("a password containing the email name is rejected, either case", () => {
  assert.ok(passwordProblem("jessmyn12345", "Jessmyn@example.com"));
  assert.ok(passwordProblem("JESSMYN12345", "jessmyn@example.com"));
});

// A two-letter local part would otherwise ban half the alphabet-containing
// passwords in existence.
test("a very short email name doesn't ban ordinary passwords", () => {
  assert.equal(passwordProblem("jo makes bread", "jo@example.com"), null);
});

test("passwordProblem tolerates a missing email", () => {
  assert.equal(passwordProblem("brisket friday mudgee"), null);
});

test("emails are lowercased and trimmed", () => {
  assert.equal(normaliseEmail("  Chef@Venue.COM.AU "), "chef@venue.com.au");
});

test("email shape is checked, not guessed at", () => {
  assert.ok(looksLikeEmail("chef@venue.com.au"));
  assert.ok(!looksLikeEmail("chef@venue"));
  assert.ok(!looksLikeEmail("chef venue.com.au"));
  assert.ok(!looksLikeEmail(""));
});
