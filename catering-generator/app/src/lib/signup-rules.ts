/**
 * What counts as a usable email and password when someone sets up their own
 * account.
 *
 * Kept here rather than in the route so the rules can be tested and so the
 * form can say the same thing the server will say. A password rejected by the
 * server after the form said it was fine is the kind of small betrayal that
 * makes people give up on a signup page.
 */

/** The shortest password worth having on an account holding costed recipes. */
export const MIN_PASSWORD = 10;

/**
 * Passwords people reach for when a box says "10 characters minimum". Not a
 * real breach list — Supabase's own leaked-password check does that job. This
 * only catches the handful that would otherwise sail through the length rule.
 */
const OBVIOUS = new Set([
  "password12",
  "password123",
  "1234567890",
  "12345678910",
  "qwertyuiop",
  "letmein123",
  "catering123",
]);

export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function looksLikeEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

/**
 * Returns a message a cook can act on, or null when the password is fine.
 *
 * The messages say what to do, not what's wrong: "make it longer" beats
 * "password does not meet complexity requirements".
 */
export function passwordProblem(password: string, email = ""): string | null {
  if (password.length < MIN_PASSWORD) {
    return `Make it at least ${MIN_PASSWORD} characters. Three words you'll remember beats one clever one.`;
  }
  if (password.length > 72) {
    // bcrypt silently ignores anything past 72 bytes, so a longer password
    // isn't the password they think it is.
    return "That's longer than 72 characters, which is as much as gets checked. Trim it a bit.";
  }
  if (password.trim() === "") {
    return "That's all spaces. Pick something you can type on a phone.";
  }
  if (OBVIOUS.has(password.toLowerCase())) {
    return "That one's on every guessing list there is. Anything else.";
  }
  const local = normaliseEmail(email).split("@")[0];
  if (local && local.length > 2 && password.toLowerCase().includes(local)) {
    return "Don't put your email address in it — that's the first thing anyone tries.";
  }
  return null;
}
