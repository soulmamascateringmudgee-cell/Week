import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server.ts";
import type { RecipeIngredient } from "@/lib/types.ts";

const CATEGORIES = [
  "Meat/Seafood",
  "Produce",
  "Dairy",
  "Dry goods",
  "Packaging",
  "Drinks",
];

/**
 * Validate what came off the form. Ingredients are stored as jsonb, so this
 * is the only thing standing between a typo and an order sheet that says
 * "NaN kg brisket" on the morning of a wedding.
 */
export function cleanIngredients(raw: unknown): RecipeIngredient[] | string {
  if (!Array.isArray(raw)) return "The ingredients are missing.";

  const rows: RecipeIngredient[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const row = entry as Record<string, unknown>;

    const item = typeof row.item === "string" ? row.item.trim() : "";
    if (item === "") continue;
    if (item.length > 200) return `"${item.slice(0, 30)}…" is too long.`;

    const qty = Number(row.qty);
    if (!Number.isFinite(qty) || qty <= 0) {
      return `"${item}" needs a quantity above zero.`;
    }

    const unit = typeof row.unit === "string" ? row.unit.trim() : "";
    if (unit === "" || unit.length > 20) {
      return `"${item}" needs a unit — kg, g, L, bunches, ea.`;
    }

    const category =
      typeof row.category === "string" && CATEGORIES.includes(row.category)
        ? (row.category as RecipeIngredient["category"])
        : "Dry goods";

    rows.push({ item, qty, unit, category });
  }

  if (rows.length === 0) return "A recipe needs at least one ingredient.";
  return rows;
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
    .from("recipes")
    .select("id, name, course, serves, ingredients, method, notes, updated_at")
    .order("name");

  if (error) {
    return NextResponse.json(
      { error: "Couldn't load your recipes." },
      { status: 500 },
    );
  }
  return NextResponse.json({ recipes: data });
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

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > 200) {
    return NextResponse.json(
      { error: "Give the dish a name so you can find it again." },
      { status: 400 },
    );
  }

  const serves = Number(body.serves);
  if (!Number.isInteger(serves) || serves < 1 || serves > 10000) {
    return NextResponse.json(
      { error: "How many people is this written for?" },
      { status: 400 },
    );
  }

  const ingredients = cleanIngredients(body.ingredients);
  if (typeof ingredients === "string") {
    return NextResponse.json({ error: ingredients }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("recipes")
    // user_id comes from the verified session, never from the request body.
    .insert({
      user_id: user.id,
      name,
      serves,
      ingredients,
      course: typeof body.course === "string" ? body.course.trim() || null : null,
      method: typeof body.method === "string" ? body.method.slice(0, 8000) || null : null,
      notes: typeof body.notes === "string" ? body.notes.slice(0, 2000) || null : null,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: "Couldn't save that recipe." }, { status: 500 });
  }
  return NextResponse.json({ id: data.id }, { status: 201 });
}
