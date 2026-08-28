import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server.ts";

/**
 * The operator's price list. One row per ingredient, matched to order lines
 * by name — so pricing "bacon" once covers every dish that uses it.
 */

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("ingredient_prices")
    .select("id, item, unit, price, supplier, updated_at")
    .order("item");

  if (error) {
    return NextResponse.json(
      { error: "Couldn't load your prices." },
      { status: 500 },
    );
  }
  // numeric comes back as a string from Postgres; the maths needs a number.
  const prices = (data ?? []).map((row) => ({
    ...row,
    price: Number(row.price),
  }));
  return NextResponse.json({ prices });
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
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const item =
    typeof body.item === "string" ? body.item.trim().toLowerCase() : "";
  if (item.length < 1 || item.length > 200) {
    return NextResponse.json(
      { error: "Which ingredient is this the price of?" },
      { status: 400 },
    );
  }

  const unit = typeof body.unit === "string" ? body.unit.trim() : "";
  if (unit.length < 1 || unit.length > 20) {
    return NextResponse.json(
      { error: "What's the price per — kg, L, ea?" },
      { status: 400 },
    );
  }

  const price = Number(body.price);
  if (!Number.isFinite(price) || price < 0 || price > 100000) {
    return NextResponse.json(
      { error: "That price doesn't look right." },
      { status: 400 },
    );
  }

  // '' means "no shop recorded" — the key ingredient_prices uses for it, so
  // the same ingredient can hold a Woolworths price and an Aldi one without
  // either overwriting the other. See migration 0007.
  const supplier =
    typeof body.supplier === "string" ? body.supplier.trim().slice(0, 100) : "";

  // Upsert: re-entering an ingredient at the same shop updates its price
  // rather than failing. Prices change, and being told off for saying so would
  // be daft. A different shop is a different row, not an update.
  const { error } = await supabase.from("ingredient_prices").upsert(
    { user_id: user.id, item, unit, price, supplier },
    { onConflict: "user_id,item,supplier" },
  );

  if (error) {
    return NextResponse.json({ error: "Couldn't save that price." }, { status: 500 });
  }

  // History is what answers "has this gone up". A price typed in by hand is as
  // real as one read off a docket; only the source differs.
  await supabase
    .from("price_history")
    .insert({ user_id: user.id, item, unit, price, supplier, source: "manual" });

  return NextResponse.json({ item }, { status: 201 });
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
    return NextResponse.json({ error: "Which price?" }, { status: 400 });
  }

  const { error } = await supabase.from("ingredient_prices").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: "Couldn't remove that price." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
