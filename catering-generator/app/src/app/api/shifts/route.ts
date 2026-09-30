import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server.ts";

/**
 * Shifts: a piece of work on a date, and everything hanging off it.
 *
 * One read returns the shift, who replied, and who's rostered, because a
 * roster page that fetched those separately would paint a shift with nobody
 * on it and then fill in — which on a phone looks like the roster was lost.
 */

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const from = new URL(request.url).searchParams.get("from");

  let query = supabase
    .from("shifts")
    .select(
      "id, job_id, title, work_date, location, detail, is_prep, asking, created_at, " +
        "shift_replies(staff_id, answer, note, replied_at), " +
        "shift_crew(staff_id, start_time, end_time)",
    )
    .order("work_date");

  if (from && DATE.test(from)) query = query.gte("work_date", from);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Couldn't load your shifts." }, { status: 500 });
  }
  return NextResponse.json({ shifts: data ?? [] });
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

  const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
  if (title === "") {
    return NextResponse.json({ error: "Give the shift a name." }, { status: 400 });
  }

  const workDate = typeof body.workDate === "string" ? body.workDate.trim() : "";
  if (!DATE.test(workDate)) {
    return NextResponse.json({ error: "Which day is it?" }, { status: 400 });
  }

  // A shift can hang off a saved job, which is what lets the crew see its
  // prep list and recipes. Row-level security means a job id that isn't
  // yours simply isn't found, so an id guessed from elsewhere attaches
  // nothing rather than borrowing someone else's job.
  let jobId: string | null = null;
  if (typeof body.jobId === "string" && body.jobId !== "") {
    const { data: job } = await supabase
      .from("jobs")
      .select("id")
      .eq("id", body.jobId)
      .maybeSingle();
    if (!job) {
      return NextResponse.json({ error: "That job isn't one of yours." }, { status: 400 });
    }
    jobId = job.id;
  }

  const { data, error } = await supabase
    .from("shifts")
    .insert({
      owner_id: user.id,
      job_id: jobId,
      title,
      work_date: workDate,
      location: text(body.location, 120),
      detail: text(body.detail, 500),
      is_prep: body.isPrep === true,
      asking: body.asking !== false,
    })
    .select("id, job_id, title, work_date, location, detail, is_prep, asking")
    .single();

  if (error) {
    return NextResponse.json({ error: "Couldn't add that shift." }, { status: 500 });
  }
  return NextResponse.json({ ...data, shift_replies: [], shift_crew: [] }, { status: 201 });
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed === "" ? null : trimmed;
}
