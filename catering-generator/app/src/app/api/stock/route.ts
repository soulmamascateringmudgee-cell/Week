import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server.ts";

/**
 * The pantry count. What's on the shelf, in the freezer, in the van.
 *
 * Read by the job planner to mark order lines you already have, so a shop
 * doesn't buy a second box of what's behind the first one.
 */

/** Above this on a pantry line is a slipped decimal, not a delivery. */
const MAX_QTY = 100_000;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("pantry_stock")
    .select("id, item, qty, unit, place, counted_on, updated_at")
    .order("item");

  if (error) {
    return NextResponse.json({ error: "Couldn't load your stock." }, { status: 500 });
  }

  // numeric comes back as a string from Postgres; the maths needs a number.
  const stock = (data ?? []).map((row) => ({ ...row, qty: Number(row.qty) }));
  return NextResponse.json({ stock });
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

  // One line or a whole spoken stocktake — the same shape either way, so the
  // voice path and the typed one can't drift apart.
  const incoming = Array.isArray(body.lines) ? body.lines : [body];

  const rows: {
    user_id: string;
    item: string;
    qty: number;
    unit: string;
    place: string;
    counted_on?: string;
  }[] = [];
  let rejected = 0;

  const countedOn =
    typeof body.countedOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.countedOn)
      ? body.countedOn
      : undefined;

  for (const raw of incoming) {
    if (typeof raw !== "object" || raw === null) {
      rejected += 1;
      continue;
    }
    const row = raw as Record<string, unknown>;

    const item =
      typeof row.item === "string" ? row.item.trim().toLowerCase() : "";
    const unit = typeof row.unit === "string" ? row.unit.trim() : "";
    const qty = Number(row.qty);
    const place =
      typeof row.place === "string" ? row.place.trim().slice(0, 100) : "";

    if (
      item.length < 1 ||
      item.length > 200 ||
      unit.length < 1 ||
      unit.length > 20 ||
      !Number.isFinite(qty) ||
      qty < 0 ||
      qty > MAX_QTY
    ) {
      rejected += 1;
      continue;
    }

    rows.push({
      user_id: user.id,
      item,
      qty,
      unit,
      place,
      ...(countedOn ? { counted_on: countedOn } : {}),
    });
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Nothing there had both a thing and an amount." },
      { status: 400 },
    );
  }

  // The same item twice in one spoken stocktake — "two boxes of tomatoes"
  // then remembering another box — would make the upsert fight itself.
  // Last one wins, matching what the review list showed at the bottom.
  const byKey = new Map<string, (typeof rows)[number]>();
  for (const row of rows) byKey.set(`${row.item}|${row.place}`, row);
  const unique = [...byKey.values()];

  const { error } = await supabase
    .from("pantry_stock")
    .upsert(unique, { onConflict: "user_id,item,place" });

  if (error) {
    return NextResponse.json({ error: "Couldn't save that stock." }, { status: 500 });
  }
  return NextResponse.json({ saved: unique.length, rejected }, { status: 201 });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Which line?" }, { status: 400 });
  }

  const { error } = await supabase.from("pantry_stock").delete().eq("id", id);
  if (error) {
    return NextResponse.json(
      { error: "Couldn't remove that line." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
