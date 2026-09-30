import { NextResponse } from "next/server";

import { minutesWorked } from "@/lib/roster.ts";
import { crewSession } from "@/lib/crew-session.ts";
import { createAdminClient } from "@/lib/supabase/admin.ts";

/**
 * Everything a casual's phone needs, in one request: who they are, what
 * they've been asked, what they're on, and their hours.
 *
 * Every query below is filtered by the session's own owner_id and staff_id.
 * Nothing in the request says who the caller is — a crew member reaching
 * this route can only ever be told about themselves and about their own
 * operator's shifts.
 *
 * What is deliberately absent: prices, costings, other people's phone
 * numbers, and anyone else's hours. A casual seeing the food cost of the
 * wedding they're working is a conversation nobody wants.
 */

export async function GET() {
  const me = await crewSession();
  if (!me) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const [shiftsResult, hoursResult] = await Promise.all([
    admin
      .from("shifts")
      .select(
        "id, title, work_date, location, detail, is_prep, asking, job_id, " +
          "shift_replies(staff_id, answer, note), " +
          "shift_crew(staff_id, start_time, end_time)",
      )
      .eq("owner_id", me.ownerId)
      .gte("work_date", today)
      .order("work_date"),
    admin
      .from("timesheets")
      .select("id, work_date, start_time, end_time, break_minutes, minutes, note, locked, shift_id")
      .eq("staff_id", me.staffId)
      .order("work_date", { ascending: false })
      .limit(40),
  ]);

  if (shiftsResult.error || hoursResult.error) {
    return NextResponse.json({ error: "Couldn't load your shifts." }, { status: 500 });
  }

  /**
   * The client isn't generated against the schema, so a select with two
   * nested tables comes back as a union with Supabase's error shape rather
   * than as rows. Named here once instead of at every field.
   */
  interface ShiftRow {
    id: string;
    title: string;
    work_date: string;
    location: string | null;
    detail: string | null;
    is_prep: boolean;
    asking: boolean;
    job_id: string | null;
    shift_replies: { staff_id: string; answer: string; note: string | null }[] | null;
    shift_crew:
      | { staff_id: string; start_time: string | null; end_time: string | null }[]
      | null;
  }

  const shifts = ((shiftsResult.data ?? []) as unknown as ShiftRow[]).map((shift) => {
    const replies = shift.shift_replies ?? [];
    const crew = shift.shift_crew ?? [];
    const mine = replies.find((reply) => reply.staff_id === me.staffId) ?? null;
    const onIt = crew.find((line) => line.staff_id === me.staffId) ?? null;
    return {
      id: shift.id,
      title: shift.title,
      workDate: shift.work_date,
      location: shift.location,
      detail: shift.detail,
      isPrep: shift.is_prep,
      asking: shift.asking,
      hasPack: shift.job_id !== null,
      // Their own answer and their own times. How many other people said
      // yes is the operator's business, not the crew's.
      myAnswer: mine?.answer ?? null,
      myNote: mine?.note ?? null,
      onRoster: onIt !== null,
      start: onIt?.start_time ?? null,
      end: onIt?.end_time ?? null,
    };
  });

  const hours = (hoursResult.data ?? []).map((row) => ({
    id: row.id,
    workDate: row.work_date,
    start: row.start_time,
    end: row.end_time,
    breakMinutes: row.break_minutes,
    minutes: row.minutes,
    note: row.note,
    locked: row.locked,
    shiftId: row.shift_id,
  }));

  return NextResponse.json({
    me: { name: me.name },
    shifts,
    hours,
    // Summed here rather than in the page so the number on a payslip
    // conversation and the number on the phone come from one place.
    minutesThisMonth: hours
      .filter((row) => row.workDate.slice(0, 7) === today.slice(0, 7))
      .reduce((total, row) => total + (row.minutes ?? 0), 0),
  });
}

/** Answering "can you work?", and logging hours. */
export async function POST(request: Request) {
  const me = await crewSession();
  if (!me) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const admin = createAdminClient();
  const shiftId = typeof body.shiftId === "string" ? body.shiftId : "";

  // The shift must belong to this crew member's operator. Without this line
  // a shift id from anywhere would be writable, because the secret key does
  // not check for us.
  const { data: shift } = shiftId
    ? await admin
        .from("shifts")
        .select("id, asking, work_date")
        .eq("id", shiftId)
        .eq("owner_id", me.ownerId)
        .maybeSingle()
    : { data: null };

  if (body.answer === "yes" || body.answer === "no") {
    if (!shift) {
      return NextResponse.json({ error: "That shift isn't on your list." }, { status: 404 });
    }
    if (!shift.asking) {
      return NextResponse.json(
        { error: "That one's already sorted — the crew is set." },
        { status: 409 },
      );
    }
    const { error } = await admin.from("shift_replies").upsert(
      {
        shift_id: shift.id,
        staff_id: me.staffId,
        answer: body.answer,
        note: typeof body.note === "string" ? body.note.trim().slice(0, 200) || null : null,
        replied_at: new Date().toISOString(),
      },
      { onConflict: "shift_id,staff_id" },
    );
    if (error) {
      return NextResponse.json({ error: "Couldn't save your answer." }, { status: 500 });
    }
    return NextResponse.json({ shiftId: shift.id, answer: body.answer });
  }

  if (body.logHours === true) {
    const workDate =
      typeof body.workDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.workDate)
        ? body.workDate
        : shift?.work_date;
    if (!workDate) {
      return NextResponse.json({ error: "Which day?" }, { status: 400 });
    }

    const start = clock(body.start);
    const end = clock(body.end);
    const breakMinutes = Number.isFinite(Number(body.breakMinutes))
      ? Math.max(0, Math.min(480, Math.round(Number(body.breakMinutes))))
      : 0;
    const minutes = minutesWorked(start, end, breakMinutes);
    if (minutes === null) {
      return NextResponse.json(
        { error: "Those times don't add up to a shift. Check the start and finish." },
        { status: 400 },
      );
    }

    const { error } = await admin.from("timesheets").insert({
      owner_id: me.ownerId,
      staff_id: me.staffId,
      shift_id: shift?.id ?? null,
      work_date: workDate,
      start_time: start,
      end_time: end,
      break_minutes: breakMinutes,
      minutes,
      note: typeof body.note === "string" ? body.note.trim().slice(0, 200) || null : null,
    });
    if (error) {
      return NextResponse.json({ error: "Couldn't save those hours." }, { status: 500 });
    }
    return NextResponse.json({ minutes });
  }

  return NextResponse.json({ error: "Nothing to do." }, { status: 400 });
}

function clock(value: unknown): string | null {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value.trim())
    ? value.trim()
    : null;
}
