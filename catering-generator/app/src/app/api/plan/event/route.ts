import { NextResponse } from "next/server";

import { planEvent } from "@/lib/event-engine.ts";
import { createClient } from "@/lib/supabase/server.ts";
import type { EventInput, Recipe } from "@/lib/types.ts";

export async function POST(request: Request) {
  let input: EventInput & { recipeIds?: unknown };
  try {
    input = (await request.json()) as EventInput & { recipeIds?: unknown };
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  // Recipes are looked up by id against the signed-in operator's own rows
  // rather than taken from the request body. The quantities that end up on an
  // order sheet should come from what was saved, not from what was posted.
  const recipeIds = Array.isArray(input.recipeIds)
    ? input.recipeIds.filter((id): id is string => typeof id === "string")
    : [];

  let recipes: Recipe[] = [];
  if (recipeIds.length > 0) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("recipes")
      .select("id, name, course, serves, ingredients")
      .in("id", recipeIds);

    if (error) {
      return NextResponse.json(
        { error: "Couldn't load the recipes for this job." },
        { status: 500 },
      );
    }
    recipes = (data ?? []) as Recipe[];

    const missing = recipeIds.length - recipes.length;
    if (missing > 0) {
      return NextResponse.json(
        {
          error: `${missing} of the dishes you picked couldn't be found. Reload the page and try again.`,
        },
        { status: 400 },
      );
    }
  }

  try {
    return NextResponse.json(planEvent({ ...input, recipes }));
  } catch (error) {
    // The engine's own errors are written to be read by a chef, so they pass
    // straight through. Anything else is a bug and shouldn't leak internals.
    const message =
      error instanceof Error
        ? error.message
        : "Couldn't build the order list from those details.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
