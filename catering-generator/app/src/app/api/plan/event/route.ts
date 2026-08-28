import { NextResponse } from "next/server";

import { planEvent } from "@/lib/event-engine.ts";
import { createClient } from "@/lib/supabase/server.ts";
import type {
  EventInput,
  IngredientPrice,
  Recipe,
  StockItem,
} from "@/lib/types.ts";

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
  let prices: IngredientPrice[] = [];
  let stock: StockItem[] = [];

  // Costing needs the price list whenever a budget was set, even on a job
  // with no recipes attached.
  const wantsCosting = recipeIds.length > 0 || input.budget !== undefined;

  if (wantsCosting) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    if (recipeIds.length > 0) {
      const { data, error } = await supabase
        .from("recipes")
        // `method` and `notes` carry the timings the prep list is built from —
        // marinades, overnight cooks, what has to be made on the morning.
        .select("id, name, course, serves, ingredients, method, notes")
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

    const { data: priceRows } = await supabase
      .from("ingredient_prices")
      // supplier included, or costing can't tell you which shop is cheapest —
      // it would silently fall back to naming none of them.
      .select("item, unit, price, supplier");
    // Postgres numeric arrives as a string; costing needs numbers.
    prices = (priceRows ?? []).map((row) => ({
      ...row,
      price: Number(row.price),
    })) as IngredientPrice[];

    const { data: stockRows } = await supabase
      .from("pantry_stock")
      .select("item, qty, unit, place");
    stock = (stockRows ?? []).map((row) => ({
      ...row,
      qty: Number(row.qty),
    })) as StockItem[];
  }

  try {
    return NextResponse.json(planEvent({ ...input, recipes, prices, stock }));
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
