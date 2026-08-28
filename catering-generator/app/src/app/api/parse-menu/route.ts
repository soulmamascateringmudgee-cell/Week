import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import { PROTEINS } from "@/lib/tables.ts";

/**
 * Optional convenience: turn a pasted menu into structured rows so nobody has
 * to hand-type fifteen items into the form.
 *
 * This does no arithmetic — every quantity still comes from the engine. If
 * there's no API key configured the route reports that plainly and the form
 * hides the paste box, so the app works fine without it.
 */

const PROTEIN_KEYS = PROTEINS.map((p) => p.key);

const SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          category: {
            type: "string",
            enum: ["main", "entree", "side", "dessert", "counter", "drink"],
          },
          proteinKey: {
            type: "string",
            enum: [...PROTEIN_KEYS, "none"],
          },
          portionG: { type: "integer" },
          shelfLife: { type: "string", enum: ["short", "medium", "long"] },
        },
        required: ["name", "category", "proteinKey", "portionG", "shelfLife"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
} as const;

const SYSTEM = `You turn a pasted restaurant, cafe, kiosk or canteen menu into structured rows for a par-level calculator.

For each dish on the menu, return one row:
- name: the dish as written on the menu.
- category: main, entree, side, dessert, counter (cabinet/pastry) or drink.
- proteinKey: the closest match from the allowed list, or "none" when the dish has no meaningful protein yield loss (salads, sides, drinks, baked goods).
- portionG: served weight in grams of the component that drives the order. Restaurant mains 160-200, cafe mains 120-150, kiosk handhelds 110-140, canteen serves 90-120, sides 90-120, salads 60-80.
- shelfLife: short for leaves, fresh fish, cut fruit, dairy-heavy prep and pastry; medium for raw proteins, hard veg, cheese and eggs; long for dry, tinned and frozen goods.

Return only dishes that actually appear in the text. Do not invent menu items, and do not estimate quantities — the calculator does that.`;

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Menu parsing isn't configured on this deployment. Add the menu items by hand — the quantities are the same either way.",
      },
      { status: 503 },
    );
  }

  let menuText: string;
  try {
    const body = (await request.json()) as { menuText?: unknown };
    menuText = typeof body.menuText === "string" ? body.menuText.trim() : "";
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  if (menuText.length < 10) {
    return NextResponse.json(
      { error: "Paste the menu first — there's nothing to read." },
      { status: 400 },
    );
  }
  if (menuText.length > 20_000) {
    return NextResponse.json(
      { error: "That menu is too long to read in one go. Split it up." },
      { status: 400 },
    );
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 16000,
      system: SYSTEM,
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: SCHEMA },
      },
      messages: [{ role: "user", content: menuText }],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "Couldn't read that menu. Add the items by hand." },
        { status: 422 },
      );
    }

    const text = response.content.find((block) => block.type === "text");
    if (!text) {
      return NextResponse.json(
        { error: "Couldn't read that menu. Add the items by hand." },
        { status: 422 },
      );
    }

    const parsed = JSON.parse(text.text) as {
      items: { proteinKey: string }[];
    };
    // "none" is a schema convenience; the engine wants the field absent.
    const items = parsed.items.map(({ proteinKey, ...rest }) =>
      proteinKey === "none" ? rest : { ...rest, proteinKey },
    );

    return NextResponse.json({ items });
  } catch (error) {
    console.error("parse-menu failed", error);
    return NextResponse.json(
      {
        error:
          "Menu parsing is unavailable right now. Add the items by hand — nothing else depends on it.",
      },
      { status: 502 },
    );
  }
}
