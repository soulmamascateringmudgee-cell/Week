import { NextResponse } from "next/server";

import { describeChange, worthMentioning } from "@/lib/price-change.ts";
import { createClient } from "@/lib/supabase/server.ts";

/**
 * What's moved lately.
 *
 * The question a caterer actually asks isn't "what does chicken cost" — the
 * price list already answers that. It's "has anything changed since I last
 * quoted", because that's what turns a job that made money into one that
 * didn't.
 *
 * So this reads each ingredient's last two recorded prices and reports the
 * difference. Only ingredients with two prices can move; one price is a
 * starting point, not a change, and saying otherwise would put "new" items in
 * a list meant for surprises.
 */

/** How many recent rows to look at. Enough for a busy month of dockets. */
const WINDOW = 400;

interface HistoryRow {
  item: string;
  unit: string;
  price: number | string;
  supplier: string | null;
  priced_on: string | null;
  created_at: string;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("price_history")
    .select("item, unit, price, supplier, priced_on, created_at")
    .order("created_at", { ascending: false })
    .limit(WINDOW);

  if (error) {
    return NextResponse.json(
      { error: "Couldn't load your price history." },
      { status: 500 },
    );
  }

  // Newest first, so the first two rows for an item are its latest price and
  // the one before it.
  const seen = new Map<string, HistoryRow[]>();
  for (const row of (data ?? []) as HistoryRow[]) {
    const rows = seen.get(row.item);
    if (rows) {
      if (rows.length < 2) rows.push(row);
    } else {
      seen.set(row.item, [row]);
    }
  }

  const moves = [];
  for (const [item, rows] of seen) {
    // One recorded price is a starting point, not a movement.
    if (rows.length < 2) continue;
    const [latest, previous] = rows;
    const change = describeChange(
      { price: Number(previous.price), unit: previous.unit },
      { price: Number(latest.price), unit: latest.unit },
    );
    moves.push({
      item,
      change,
      supplier: latest.supplier,
      when: latest.priced_on ?? latest.created_at.slice(0, 10),
    });
  }

  return NextResponse.json({ moves: worthMentioning(moves) });
}
