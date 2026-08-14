import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/access.ts";
import { createClient } from "@/lib/supabase/server.ts";

/**
 * The invite list. Admin only — checked here so the caller gets a sensible
 * message, and enforced again by row-level security so the check here is not
 * the thing standing between a stranger and the list.
 */

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { supabase, denied: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  }
  if (!(await isAdmin(supabase))) {
    return {
      supabase,
      denied: NextResponse.json({ error: "Only the owner can manage invites." }, { status: 403 }),
    };
  }
  return { supabase, user, denied: null };
}

export async function GET() {
  const { supabase, denied } = await requireAdmin();
  if (denied) return denied;

  const { data, error } = await supabase
    .from("allowed_emails")
    .select("email, is_admin, note, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Couldn't load the invite list." }, { status: 500 });
  }
  return NextResponse.json({ invites: data });
}

export async function POST(request: Request) {
  const { supabase, user, denied } = await requireAdmin();
  if (denied) return denied;

  let body: { email?: unknown; note?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  // Lowercased on the way in, because that's how the list is stored and how
  // sign-in looks it up. "Jess@..." and "jess@..." are the same person.
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "That doesn't look like an email address." }, { status: 400 });
  }

  const note = typeof body.note === "string" ? body.note.trim().slice(0, 200) || null : null;

  const { error } = await supabase
    .from("allowed_emails")
    .insert({ email, note, invited_by: user!.id });

  if (error) {
    // 23505 is the primary-key clash: they're already on the list.
    if (error.code === "23505") {
      return NextResponse.json({ error: `${email} is already invited.` }, { status: 409 });
    }
    return NextResponse.json({ error: "Couldn't add that invite." }, { status: 500 });
  }
  return NextResponse.json({ email }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { supabase, denied } = await requireAdmin();
  if (denied) return denied;

  const email = new URL(request.url).searchParams.get("email")?.trim().toLowerCase() ?? "";
  if (!email) {
    return NextResponse.json({ error: "Which email?" }, { status: 400 });
  }

  // Locking yourself out of your own invite list is not a recoverable mistake
  // from inside the app, so don't allow it.
  const { data: target, error: lookupError } = await supabase
    .from("allowed_emails")
    .select("is_admin")
    .eq("email", email)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: "Couldn't check that invite." }, { status: 500 });
  }
  if (!target) {
    return NextResponse.json({ error: `${email} isn't on the list.` }, { status: 404 });
  }
  if (target.is_admin) {
    return NextResponse.json(
      { error: "That's an owner account. Remove it in Supabase if you really mean to." },
      { status: 400 },
    );
  }

  const { error } = await supabase.from("allowed_emails").delete().eq("email", email);
  if (error) {
    return NextResponse.json({ error: "Couldn't remove that invite." }, { status: 500 });
  }
  return NextResponse.json({ email });
}
