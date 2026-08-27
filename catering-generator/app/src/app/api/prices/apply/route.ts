import { NextResponse } from "next/server";

import { normaliseUnit } from "@/lib/price-change.ts";
import { createClient } from "@/lib/supabase/server.ts";

/**
 * Apply a batch of reviewed prices — from an invoice, after the cook has
 * looked at them.
 *
 * Two writes per line, and they mean different things. `ingredient_prices` is
 * overwritten: it's what a job gets costed against, so it holds today's price
 * and nothing else. `price_history` is appended: it's what answers "has this
 * gone up", which the current price alone can never do.
 *
 * Nothing here recomputes a price. The numbers arriving have already been
 * through the review table, and silently changing one after it was approved
 * would mean the screen and the database disagreed about what was saved.
 */

interface IncomingLine {
  item: string;
  unit: string;
  price: number;
}

/** Anything above this on a food invoice line is a misread decimal point. */
const MAX_PRICE = 100_000;

function clean(raw: unknown): IncomingLine | null {
  if (typeof raw !== "object" || raw === null) return null;
  const row = raw as Record<string, unknown>;

  const item = typeof row.item === "string" ? row.item.trim().toLowerCase() : "";
  if (item.length < 1 || item.length > 200) return null;

  const unit = typeof row.unit === "string" ? normaliseUnit(row.unit) : "";
  if (unit.length < 1 || unit.length > 20) return null;

  const price = Number(row.price);
  if (!Number.isFinite(price) || price < 0 || price > MAX_PRICE) return null;

  return { item, unit, price };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: {
    lines?: unknown;
    supplier?: unknown;
    pricedOn?: unknown;
    source?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  }

  const cleaned: IncomingLine[] = [];
  let rejected = 0;
  for (const raw of body.lines) {
    const line = clean(raw);
    if (line) cleaned.push(line);
    else rejected += 1;
  }

  if (cleaned.length === 0) {
    return NextResponse.json(
      { error: "None of those lines had a usable price." },
      { status: 400 },
    );
  }

  // The same ingredient twice on one docket — two cuts of the same thing, say
  // — would make the upsert fight itself. Last one wins, matching what the
  // review table showed at the bottom.
  const byItem = new Map<string, IncomingLine>();
  for (const line of cleaned) byItem.set(line.item, line);
  const lines = [...byItem.values()];

  // '' means "no shop recorded", and is the key ingredient_prices uses for
  // it. Null is no longer allowed there — see migration 0007.
  const supplier =
    typeof body.supplier === "string" ? body.supplier.trim().slice(0, 100) : "";
  // The invoice's own date, not today's. A docket entered a fortnight late
  // still belongs at its own date, or the history reads out of order.
  const pricedOn =
    typeof body.pricedOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.pricedOn)
      ? body.pricedOn
      : null;
  const source = body.source === "invoice" ? "invoice" : "manual";

  const { error: priceError } = await supabase.from("ingredient_prices").upsert(
    lines.map((line) => ({
      user_id: user.id,
      item: line.item,
      unit: line.unit,
      price: line.price,
      supplier,
    })),
    { onConflict: "user_id,item,supplier" },
  );

  if (priceError) {
    return NextResponse.json(
      { error: "Couldn't save those prices." },
      { status: 500 },
    );
  }

  // History is the second write and can fail on its own. If it does, the
  // prices are still correct — say what happened rather than implying the
  // whole thing failed and inviting a second scan that double-counts.
  const { error: historyError } = await supabase.from("price_history").insert(
    lines.map((line) => ({
      user_id: user.id,
      item: line.item,
      unit: line.unit,
      price: line.price,
      supplier,
      source,
      priced_on: pricedOn,
    })),
  );

  return NextResponse.json({
    saved: lines.length,
    rejected,
    historyRecorded: !historyError,
    ...(historyError
      ? {
          warning:
            "Prices are saved and correct. The price history didn't record this time, so these won't show up in what's moved.",
        }
      : {}),
  });
}
