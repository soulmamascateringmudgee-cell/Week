import { NextResponse } from "next/server";

import { crewSession } from "@/lib/crew-session.ts";
import { createAdminClient } from "@/lib/supabase/admin.ts";
import type { EventPlan } from "@/lib/types.ts";

/**
 * The job pack a crew member gets on the day: the prep list and the dish
 * sheets, at this job's real size.
 *
 * It is the plan that was saved with the job, not a fresh one. The job the
 * food was ordered against is the job being cooked, and rebuilding it here
 * from today's recipes could hand a cook a sheet that doesn't match the
 * delivery sitting in the coolroom.
 *
 * Three things are cut out before it leaves the server, and the cut happens
 * here rather than in the page: a page that fetches the whole plan and only
 * renders part of it has still sent the rest to the phone.
 *
 *  - the order list, which is the operator's buying
 *  - the costing, every price and the cost per head
 *  - anything about the budget
 *
 * A casual seeing the food cost of the wedding they're working on, or what
 * the meat cost, is a conversation nobody wants to have at 6am.
 */

export async function GET(request: Request) {
  const me = await crewSession();
  if (!me) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const shiftId = new URL(request.url).searchParams.get("shiftId") ?? "";
  if (shiftId === "") {
    return NextResponse.json({ error: "Which shift?" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: shift } = await admin
    .from("shifts")
    .select("id, title, work_date, job_id")
    .eq("id", shiftId)
    .eq("owner_id", me.ownerId)
    .maybeSingle();

  if (!shift) {
    return NextResponse.json({ error: "That shift isn't on your list." }, { status: 404 });
  }
  if (!shift.job_id) {
    return NextResponse.json({ error: "No job pack on this one yet." }, { status: 404 });
  }

  const { data: job } = await admin
    .from("jobs")
    .select("title, event_date, plan")
    .eq("id", shift.job_id)
    .eq("user_id", me.ownerId)
    .maybeSingle();

  if (!job?.plan) {
    return NextResponse.json(
      { error: "The order list for this job hasn't been built yet." },
      { status: 404 },
    );
  }

  const plan = job.plan as EventPlan;

  return NextResponse.json({
    shift: { title: shift.title, workDate: shift.work_date },
    job: { title: job.title, eventDate: job.event_date, guests: plan.guests },
    prep: plan.prep ?? [],
    dishes: plan.dishSheets ?? [],
  });
}
