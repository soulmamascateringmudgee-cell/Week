import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server.ts";

type Params = { params: Promise<{ id: string }> };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

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
  if (typeof body.title === "string" && body.title.trim() !== "") {
    patch.title = body.title.trim().slice(0, 120);
  }
  if (typeof body.workDate === "string" && DATE.test(body.workDate)) {
    patch.work_date = body.workDate;
  }
  if ("location" in body) patch.location = text(body.location, 120);
  if ("detail" in body) patch.detail = text(body.detail, 500);
  if (typeof body.isPrep === "boolean") patch.is_prep = body.isPrep;
  if (typeof body.asking === "boolean") patch.asking = body.asking;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("shifts")
    .update(patch)
    .eq("id", id)
    .select("id, job_id, title, work_date, location, detail, is_prep, asking")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Couldn't save that." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Shift not found." }, { status: 404 });
  }
  return NextResponse.json({ shift: data });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { error } = await supabase.from("shifts").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: "Couldn't delete that shift." }, { status: 500 });
  }
  return NextResponse.json({ id });
}

/**
 * Putting someone on, taking someone off, or changing their hours.
 *
 * One endpoint rather than three, because it is one action from where the
 * operator is standing: this person, these times, on or off.
 */
export async function PUT(request: Request, { params }: Params) {
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

  const staffId = typeof body.staffId === "string" ? body.staffId : "";
  if (staffId === "") {
    return NextResponse.json({ error: "Which person?" }, { status: 400 });
  }

  // The shift has to be one of ours before anything is written against it.
  // Row-level security would refuse the write anyway; checking first is what
  // turns a silent no-op into a message that says what happened.
  const { data: shift } = await supabase
    .from("shifts")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!shift) {
    return NextResponse.json({ error: "Shift not found." }, { status: 404 });
  }

  if (body.on === false) {
    const { error } = await supabase
      .from("shift_crew")
      .delete()
      .eq("shift_id", id)
      .eq("staff_id", staffId);
    if (error) {
      return NextResponse.json({ error: "Couldn't take them off." }, { status: 500 });
    }
    return NextResponse.json({ shiftId: id, staffId, on: false });
  }

  const { data: person } = await supabase
    .from("staff")
    .select("id")
    .eq("id", staffId)
    .maybeSingle();
  if (!person) {
    return NextResponse.json({ error: "Not on your crew." }, { status: 400 });
  }

  const { error } = await supabase.from("shift_crew").upsert(
    {
      shift_id: id,
      staff_id: staffId,
      start_time: clock(body.start),
      end_time: clock(body.end),
    },
    { onConflict: "shift_id,staff_id" },
  );

  if (error) {
    return NextResponse.json({ error: "Couldn't put them on." }, { status: 500 });
  }
  return NextResponse.json({ shiftId: id, staffId, on: true });
}

function clock(value: unknown): string | null {
  return typeof value === "string" && TIME.test(value.trim()) ? value.trim() : null;
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed === "" ? null : trimmed;
}
