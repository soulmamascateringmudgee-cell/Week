import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server.ts";
import { cleanIngredients } from "../route.ts";

type Params = { params: Promise<{ id: string }> };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  // Row-level security scopes this to the signed-in operator, so a guessed id
  // returns nothing rather than someone else's recipe.
  const { data, error } = await supabase
    .from("recipes")
    .select("id, name, course, serves, ingredients, method, notes")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Couldn't load that recipe." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Recipe not found." }, { status: 404 });
  }
  return NextResponse.json({ recipe: data });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const update: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 1 || name.length > 200) {
      return NextResponse.json({ error: "The dish needs a name." }, { status: 400 });
    }
    update.name = name;
  }

  if (body.serves !== undefined) {
    const serves = Number(body.serves);
    if (!Number.isInteger(serves) || serves < 1 || serves > 10000) {
      return NextResponse.json(
        { error: "How many people is this written for?" },
        { status: 400 },
      );
    }
    update.serves = serves;
  }

  if (body.ingredients !== undefined) {
    const ingredients = cleanIngredients(body.ingredients);
    if (typeof ingredients === "string") {
      return NextResponse.json({ error: ingredients }, { status: 400 });
    }
    update.ingredients = ingredients;
  }

  if (body.course !== undefined) {
    update.course =
      typeof body.course === "string" ? body.course.trim() || null : null;
  }
  if (body.method !== undefined) {
    update.method =
      typeof body.method === "string" ? body.method.slice(0, 8000) || null : null;
  }
  if (body.notes !== undefined) {
    update.notes =
      typeof body.notes === "string" ? body.notes.slice(0, 2000) || null : null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { error } = await supabase.from("recipes").update(update).eq("id", id);
  if (error) {
    return NextResponse.json({ error: "Couldn't save that recipe." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: "Couldn't delete that recipe." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
