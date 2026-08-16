import { NextResponse } from "next/server";

import {
  looksLikeEmail,
  normaliseEmail,
  passwordProblem,
} from "@/lib/signup-rules.ts";
import { adminClientConfigured, createAdminClient } from "@/lib/supabase/admin.ts";

/**
 * Setting up your own account, once you've been invited.
 *
 * Being on `allowed_emails` is the whole permission model, so this route does
 * one thing: for an address already on that list and with no account yet, it
 * creates the account with the password they chose.
 *
 * The account is created already confirmed. There is no verification email,
 * on purpose — the invite list *is* the verification. Jessmyn typed that
 * address in herself after talking to the person, which is a stronger check
 * than a link anyone who can read the inbox can click, and it means signing up
 * doesn't depend on an email arriving at all.
 *
 * On a "that address isn't invited" reply this does tell a stranger whether a
 * given email is on the list. That's a deliberate trade: the list is a handful
 * of caterers Jessmyn has spoken to, and being vague here would strand an
 * invited operator who mistyped their own address with no idea what went
 * wrong. Being useful to the invited person wins.
 */
export async function POST(request: Request) {
  if (!adminClientConfigured()) {
    return NextResponse.json(
      {
        error:
          "Setting your own password isn't switched on yet. Tell Jessmyn and she'll sort it out.",
      },
      { status: 503 },
    );
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = (await request.json()) as { email?: unknown; password?: unknown };
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? normaliseEmail(body.email) : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!looksLikeEmail(email)) {
    return NextResponse.json(
      { error: "That doesn't look like an email address." },
      { status: 400 },
    );
  }

  const problem = passwordProblem(password, email);
  if (problem) {
    return NextResponse.json({ error: problem }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: invite, error: inviteError } = await admin
    .from("allowed_emails")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  if (inviteError) {
    return NextResponse.json(
      { error: "Couldn't check the invite list just now. Try again in a moment." },
      { status: 500 },
    );
  }

  if (!invite) {
    return NextResponse.json(
      {
        error: `${email} isn't on the invite list. Check the address is exactly the one you were invited on — or ask Jessmyn to add it.`,
      },
      { status: 403 },
    );
  }

  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) {
    // Supabase reports an existing account through a couple of different
    // shapes depending on version, so match on the substance rather than one
    // exact string. Sending them to sign in is right either way.
    const message = createError.message.toLowerCase();
    if (
      message.includes("already been registered") ||
      message.includes("already registered") ||
      message.includes("already exists")
    ) {
      return NextResponse.json(
        {
          error:
            "There's already an account on that email. Sign in instead — and if you've forgotten the password, ask Jessmyn to reset it.",
        },
        { status: 409 },
      );
    }
    // Supabase's own wording is better than a guess here: a rejected weak
    // password says which rule it broke.
    return NextResponse.json({ error: createError.message }, { status: 400 });
  }

  return NextResponse.json({ email }, { status: 201 });
}
