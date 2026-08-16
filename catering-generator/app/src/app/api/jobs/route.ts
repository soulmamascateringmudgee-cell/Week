import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server.ts";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("jobs")
    .select("id, mode, title, event_date, actuals_note, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Couldn't load your jobs." }, { status: 500 });
  }
  return NextResponse.json({ jobs: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: { mode?: unknown; title?: unknown; eventDate?: unknown; input?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const mode = body.mode;
  if (mode !== "event" && mode !== "service") {
    return NextResponse.json({ error: "Unknown job type." }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (title.length < 1 || title.length > 200) {
    return NextResponse.json(
      { error: "Give the job a name so you can find it again." },
      { status: 400 },
    );
  }

  if (typeof body.input !== "object" || body.input === null || Array.isArray(body.input)) {
    return NextResponse.json({ error: "Missing the job details." }, { status: 400 });
  }

  const eventDate =
    typeof body.eventDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.eventDate)
      ? body.eventDate
      : null;

  const { data, error } = await supabase
    .from("jobs")
    // user_id comes from the verified session, never from the request body.
    .insert({ user_id: user.id, mode, title, event_date: eventDate, input: body.input })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: "Couldn't save that job." }, { status: 500 });
  }
  return NextResponse.json({ id: data.id }, { status: 201 });
}
