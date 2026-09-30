import { NextResponse } from "next/server";

import { hashPin, pinProblem } from "@/lib/crew-access.ts";
import { createClient } from "@/lib/supabase/server.ts";

/**
 * The crew list.
 *
 * A PIN goes in and never comes back out — the operator sets one and reads
 * it to the person, and if it's forgotten it gets set again. There is no
 * screen anywhere in this app that shows a staff PIN, because the moment
 * there is, a phone left on a bench is everyone's login.
 */

const MAX_NAME = 80;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("staff")
    .select("id, name, phone, role, note, active, created_at, pin_hash")
    .order("active", { ascending: false })
    .order("name");

  if (error) {
    return NextResponse.json({ error: "Couldn't load your crew." }, { status: 500 });
  }

  // Whether they can sign in is useful; the hash itself is not, and it isn't
  // leaving the server.
  const staff = (data ?? []).map(({ pin_hash, ...rest }) => ({
    ...rest,
    hasPin: Boolean(pin_hash),
  }));
  return NextResponse.json({ staff });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim().slice(0, MAX_NAME) : "";
  if (name === "") {
    return NextResponse.json({ error: "They need a name." }, { status: 400 });
  }

  const pin = body.pin;
  let pinHash: string | null = null;
  if (pin !== undefined && pin !== null && pin !== "") {
    const problem = pinProblem(pin);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    pinHash = hashPin(String(pin).trim());
  }

  const { data, error } = await supabase
    .from("staff")
    .insert({
      owner_id: user.id,
      name,
      phone: text(body.phone, 40),
      role: text(body.role, 40),
      note: text(body.note, 200),
      pin_hash: pinHash,
    })
    .select("id, name, phone, role, note, active")
    .single();

  if (error) {
    // 23505 is the one unique index on this table: the same name twice.
    if (error.code === "23505") {
      return NextResponse.json(
        { error: `${name} is already on your crew.` },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Couldn't add them." }, { status: 500 });
  }

  return NextResponse.json({ ...data, hasPin: pinHash !== null }, { status: 201 });
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed === "" ? null : trimmed;
}
