import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server.ts";

type Params = { params: Promise<{ id: string }> };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  // Row-level security scopes this to the signed-in operator, so a guessed id
  // returns nothing rather than someone else's job.
  const { data, error } = await supabase
    .from("jobs")
    .select("id, mode, title, event_date, input, plan, actuals_note, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Couldn't load that job." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }
  return NextResponse.json({ job: data });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: { actualsNote?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  if (typeof body.actualsNote !== "string") {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { error } = await supabase
    .from("jobs")
    .update({ actuals_note: body.actualsNote.slice(0, 4000) })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Couldn't save that note." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { error } = await supabase.from("jobs").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: "Couldn't delete that job." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
