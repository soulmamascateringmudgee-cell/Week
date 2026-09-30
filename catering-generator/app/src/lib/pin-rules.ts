/**
 * What makes a PIN acceptable. No crypto, no secrets, no Node.
 *
 * Split out from `crew-access.ts` deliberately. Both the operator's crew
 * page and the staff sign-in page check a PIN as it's typed, so these run in
 * the browser — and `crew-access.ts` imports `node:crypto` for the hashing.
 * A client component importing that file only builds because the bundler
 * happens to shake the unused crypto out, which is a thing that works until
 * it doesn't. The rules live here so nothing has to be shaken.
 *
 * The same rules run again on the server before anything is stored; this
 * copy exists to tell someone what's wrong while they're still typing.
 */

export const PIN_LENGTH = 4;

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
 * Choosing a PIN for the first time, where it's typed twice.
 *
 * A casual setting their own PIN has nobody to check it with — get it wrong
 * and they're locked out of a roster on the morning of a job. So the second
 * box is checked here, before anything is stored.
 *
 * The PIN's own problems are reported first: "those two don't match" when
 * the real fault is that it's three digits sends someone off retyping the
 * wrong thing.
 */
export function pinConfirmProblem(pin: unknown, confirm: unknown): string | null {
  const problem = pinProblem(pin);
  if (problem) return problem;
  if (typeof confirm !== "string" || confirm.trim() === "") {
    return "Type it a second time so we know it's right.";
  }
  return String(pin).trim() === confirm.trim() ? null : "Those two don't match.";
}
