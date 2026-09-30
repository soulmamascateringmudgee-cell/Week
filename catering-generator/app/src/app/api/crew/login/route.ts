import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  LOCK_MINUTES,
  MAX_ATTEMPTS,
  hashPin,
  hashToken,
  isLocked,
  lockFor,
  minutesUntil,
  newSessionToken,
  normaliseCrewCode,
  pinConfirmProblem,
  pinMatches,
  sessionExpiry,
} from "@/lib/crew-access.ts";
import { CREW_COOKIE } from "@/lib/crew-session.ts";
import { adminClientConfigured, createAdminClient } from "@/lib/supabase/admin.ts";

/**
 * A casual signing in: which crew, which name, four digits.
 *
 * Three things this route is careful about.
 *
 * It never says which half was wrong. "That PIN doesn't match" and "no such
 * name" are the same message, because the difference between them is a list
 * of who works here, handed out to anyone with the link.
 *
 * It counts failures on the staff row, not in memory. A serverless function
 * forgets between requests, so an in-memory counter is no counter at all.
 *
 * It rate-limits before it checks. Five wrong tries and the name is shut for
 * fifteen minutes, which turns ten thousand possible PINs into a week of
 * guessing rather than a minute of it.
 */


/**
 * The crew side runs on the secret key, because crew members have no
 * Supabase account for row-level security to key off. A deployment without
 * that key can't run this at all, and should say so rather than throwing a
 * stack trace at someone standing in a car park.
 */
const NO_KEY = "The crew sign-in isn't set up on this deployment.";

const VAGUE = "That name and PIN don't go together.";

/** Said the same way whether the lock just came on or was already on. */
function shutFor(minutes: number): string {
  return `Too many tries. Try again in ${minutes} minutes, or ask whoever runs the roster to reset your PIN.`;
}

export async function GET(request: Request) {
  // The names on a crew, for the picker. Reachable by anyone holding the
  // crew link, which is the same thing a printed roster on a kitchen wall
  // gives away — and without it nobody can sign in at all. Phone numbers,
  // hours and everything else stay behind the PIN.
  if (!adminClientConfigured()) {
    return NextResponse.json({ error: NO_KEY }, { status: 503 });
  }
  const code = normaliseCrewCode(new URL(request.url).searchParams.get("code"));
  if (!code) return NextResponse.json({ error: "Unknown crew." }, { status: 404 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, business_name")
    .ilike("crew_code", code)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "Unknown crew." }, { status: 404 });

  const { data } = await admin
    .from("staff")
    .select("id, name, pin_hash")
    .eq("owner_id", profile.id)
    .eq("active", true)
    .order("name");

  // Everyone active, with a flag for who hasn't chosen a PIN yet, so the
  // page can ask them to set one instead of showing an empty list. The hash
  // itself never leaves the server.
  return NextResponse.json({
    crew: profile.business_name ?? "Crew",
    people: (data ?? []).map(({ pin_hash, ...rest }) => ({
      ...rest,
      hasPin: Boolean(pin_hash),
    })),
  });
}

export async function POST(request: Request) {
  if (!adminClientConfigured()) {
    return NextResponse.json({ error: NO_KEY }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const code = normaliseCrewCode(body.code);
  const staffId = typeof body.staffId === "string" ? body.staffId : "";
  const pin = typeof body.pin === "string" ? body.pin.trim() : "";

  if (!code || staffId === "" || pin === "") {
    return NextResponse.json({ error: VAGUE }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .ilike("crew_code", code)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: VAGUE }, { status: 401 });

  const { data: person } = await admin
    .from("staff")
    .select("id, name, pin_hash, active, pin_attempts, pin_locked_until")
    .eq("id", staffId)
    .eq("owner_id", profile.id)
    .maybeSingle();

  if (!person || !person.active) {
    return NextResponse.json({ error: VAGUE }, { status: 401 });
  }

  const now = new Date();

  /**
   * Nobody has a PIN until they choose one.
   *
   * Setting thirty-nine PINs by hand and reading each one down the phone is
   * how a roster never gets used, so the first person to open the
   * link under their own name picks their own. It is a real trade: until a name is
   * claimed, anyone holding the link could claim it. The window is short,
   * the link goes to the crew, and the operator can see on the Crew tab
   * exactly who has signed in — but it is a trade, not a free win.
   *
   * The update is conditional on the PIN still being unset, so two people
   * racing for the same name cannot both win: the second one updates no
   * rows and is turned away with the same message as a wrong PIN.
   */
  if (!person.pin_hash) {
    const problem = pinConfirmProblem(pin, body.confirm);
    if (problem) {
      return NextResponse.json({ error: problem, needsPin: true }, { status: 400 });
    }

    const { data: claimed } = await admin
      .from("staff")
      .update({ pin_hash: hashPin(pin), pin_attempts: 0, pin_locked_until: null })
      .eq("id", person.id)
      .is("pin_hash", null)
      .select("id");

    if (!claimed || claimed.length === 0) {
      return NextResponse.json({ error: VAGUE }, { status: 401 });
    }
    return signedIn(admin, person.id, profile.id, person.name, now);
  }

  if (isLocked(person.pin_locked_until, now)) {
    return NextResponse.json(
      { error: shutFor(minutesUntil(person.pin_locked_until as string, now)) },
      { status: 429 },
    );
  }

  if (!pinMatches(pin, person.pin_hash)) {
    const attempts = (person.pin_attempts ?? 0) + 1;
    const until = lockFor(attempts, now);
    await admin
      .from("staff")
      .update({
        pin_attempts: until ? 0 : attempts,
        pin_locked_until: until ? until.toISOString() : null,
      })
      .eq("id", person.id);

    if (until) {
      return NextResponse.json({ error: shutFor(LOCK_MINUTES) }, { status: 429 });
    }
    return NextResponse.json(
      { error: VAGUE, triesLeft: MAX_ATTEMPTS - attempts },
      { status: 401 },
    );
  }

  await admin
    .from("staff")
    .update({ pin_attempts: 0, pin_locked_until: null })
    .eq("id", person.id);

  return signedIn(admin, person.id, profile.id, person.name, now);
}

/** Issue the session cookie. Shared by signing in and by claiming a name. */
async function signedIn(
  admin: ReturnType<typeof createAdminClient>,
  staffId: string,
  ownerId: string,
  name: string,
  now: Date,
) {
  const token = newSessionToken();
  const expires = sessionExpiry(now);
  const { error } = await admin.from("crew_sessions").insert({
    token_hash: hashToken(token),
    staff_id: staffId,
    owner_id: ownerId,
    expires_at: expires.toISOString(),
  });
  if (error) {
    return NextResponse.json({ error: "Couldn't sign you in just now." }, { status: 500 });
  }

  const response = NextResponse.json({ name });
  response.cookies.set(CREW_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
  return response;
}

export async function DELETE() {
  // Signing out removes the row, not just the cookie. A token still valid in
  // the database is a login for anyone who kept a copy of it.
  const jar = await cookies();
  const token = jar.get(CREW_COOKIE)?.value;
  if (token) {
    await createAdminClient()
      .from("crew_sessions")
      .delete()
      .eq("token_hash", hashToken(token));
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(CREW_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
