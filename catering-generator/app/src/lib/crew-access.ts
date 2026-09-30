import { randomBytes, createHash, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * How a casual gets into the crew app.
 *
 * Not an email and a password. Staff here are casuals who work a handful of
 * days a year; asking them to keep a password for a roster is how a roster
 * stops being used. They pick their name off the operator's list and type
 * four digits.
 *
 * Four digits is ten thousand guesses, which is nothing to a script, so the
 * strength has to come from somewhere other than the PIN's length:
 *
 *  - the attempt limit (five, then that name is shut for fifteen minutes),
 *    which is enforced by the route using `lockFor` below;
 *  - the PIN being hashed with scrypt and a per-person salt, so the table
 *    is not a list of working logins even to someone holding the database;
 *  - the crew URL carrying an operator code, so a stranger needs the link
 *    before any of this is even reachable.
 *
 * What's behind it is a roster, a prep list and the hours someone worked.
 * Worth protecting properly; not worth a password reset flow for a casual
 * standing in a kitchen at 6am.
 */

export const PIN_LENGTH = 4;
export const MAX_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

/** PINs that are the first thing anyone tries. */
const OBVIOUS = new Set([
  "0000", "1111", "2222", "3333", "4444", "5555", "6666", "7777", "8888",
  "9999", "1234", "4321", "0123", "3210", "1212", "2121",
]);

/** Null when the PIN is fine, otherwise what's wrong with it, in plain words. */
export function pinProblem(pin: unknown): string | null {
  if (typeof pin !== "string") return "Type a PIN.";
  const trimmed = pin.trim();
  if (trimmed === "") return "Type a PIN.";
  if (!/^\d+$/.test(trimmed)) return "Numbers only.";
  if (trimmed.length !== PIN_LENGTH) return `It needs to be ${PIN_LENGTH} digits.`;
  if (OBVIOUS.has(trimmed)) return "Pick something less guessable than that.";
  return null;
}

/**
 * scrypt, with its own salt, stored as one string.
 *
 * The cost parameters are scrypt's defaults, which take a few milliseconds —
 * fast enough that a cook doesn't notice, slow enough that the attempt limit
 * is what stops a guesser rather than the hash.
 */
export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(pin, salt, 32).toString("hex");
  return `scrypt$${salt}$${key}`;
}

/** Constant-time, and false for anything it doesn't recognise. */
export function pinMatches(pin: string, stored: string | null | undefined): boolean {
  if (typeof stored !== "string") return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, key] = parts;
  let expected: Buffer;
  try {
    expected = Buffer.from(key, "hex");
  } catch {
    return false;
  }
  if (expected.length === 0) return false;
  const actual = scryptSync(pin, salt, expected.length);
  return timingSafeEqual(actual, expected);
}

/** When a name should reopen, given how many tries have failed. */
export function lockFor(attempts: number, now: Date): Date | null {
  if (attempts < MAX_ATTEMPTS) return null;
  return new Date(now.getTime() + LOCK_MINUTES * 60_000);
}

/** True while a name is shut. A null or past lock is not a lock. */
export function isLocked(lockedUntil: string | null | undefined, now: Date): boolean {
  if (!lockedUntil) return false;
  const until = new Date(lockedUntil);
  return Number.isFinite(until.getTime()) && until > now;
}

/** How long until a locked name reopens, rounded up, for telling someone. */
export function minutesUntil(lockedUntil: string, now: Date): number {
  const ms = new Date(lockedUntil).getTime() - now.getTime();
  return Math.max(1, Math.ceil(ms / 60_000));
}

// ---------------------------------------------------------------- sessions

/**
 * A session is a long random string the crew member's browser keeps, and a
 * hash of it in the database. Nothing is signed, so there is no secret to
 * add to the deployment and nothing to rotate; and because only the hash is
 * stored, a copy of the table doesn't let anyone in.
 */
export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const SESSION_DAYS = 60;

export function sessionExpiry(now: Date): Date {
  return new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60_000);
}

// ------------------------------------------------------------- crew code

/**
 * The bit of the crew URL that says whose crew it is: /crew/soulmamas.
 *
 * Derived from the business name so it's something an operator can read out
 * over the phone, and unique-checked by the database rather than here.
 */
export function crewCodeFrom(name: string | null | undefined): string {
  const base = (name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 20);
  return base.length >= 3 ? base : `crew${randomBytes(3).toString("hex")}`;
}

/** What a code typed or pasted into a URL normalises to before lookup. */
export function normaliseCrewCode(code: unknown): string | null {
  if (typeof code !== "string") return null;
  const clean = code.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return clean.length >= 3 && clean.length <= 20 ? clean : null;
}
