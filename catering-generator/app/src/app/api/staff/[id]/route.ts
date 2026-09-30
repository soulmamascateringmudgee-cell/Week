import { NextResponse } from "next/server";

import { hashPin, pinProblem } from "@/lib/crew-access.ts";
import { createClient } from "@/lib/supabase/server.ts";

type Params = { params: Promise<{ id: string }> };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim() !== "") {
    patch.name = body.name.trim().slice(0, 80);
  }
  if ("phone" in body) patch.phone = text(body.phone, 40);
  if ("role" in body) patch.role = text(body.role, 40);
  if ("note" in body) patch.note = text(body.note, 200);
  if (typeof body.active === "boolean") patch.active = body.active;

  if ("pin" in body) {
    if (body.pin === null || body.pin === "") {
      // Clearing the PIN takes their access away without taking their
      // history with it — the hours they've worked stay on the timesheet.
      patch.pin_hash = null;
    } else {
      const problem = pinProblem(body.pin);
      if (problem) return NextResponse.json({ error: problem }, { status: 400 });
      patch.pin_hash = hashPin(String(body.pin).trim());
    }
    // A new PIN clears the lockout. Five wrong guesses shouldn't keep
    // someone out after the operator has just reset it for them.
    patch.pin_attempts = 0;
    patch.pin_locked_until = null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("staff")
    .update(patch)
    .eq("id", id)
    .select("id, name, phone, role, note, active, pin_hash")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Someone on your crew already has that name." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Couldn't save that." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Not on your crew." }, { status: 404 });
  }

  const { pin_hash, ...rest } = data;
  return NextResponse.json({ ...rest, hasPin: Boolean(pin_hash) });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  // Deleting takes their hours with it — the timesheet rows point at this
  // row. Someone who has stopped working for you gets marked inactive
  // instead, which is what the crew page offers; this is here for a name
  // typed in wrong five minutes ago.
  const { count, error } = await supabase
    .from("timesheets")
    .select("id", { count: "exact", head: true })
    .eq("staff_id", id);

  if (error) {
    return NextResponse.json({ error: "Couldn't check their hours." }, { status: 500 });
  }
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          "They have hours on a timesheet, so removing them would delete those too. Mark them as left instead.",
      },
      { status: 409 },
    );
  }

  const { error: deleteError } = await supabase.from("staff").delete().eq("id", id);
  if (deleteError) {
    return NextResponse.json({ error: "Couldn't remove them." }, { status: 500 });
  }
  return NextResponse.json({ id });
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed === "" ? null : trimmed;
}
