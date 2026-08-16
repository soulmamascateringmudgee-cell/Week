import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server.ts";

/**
 * Read a photo of a recipe — a card, a page of a book, a page torn out of a
 * folder, someone's handwriting — into the fields the form wants.
 *
 * Typing a recipe in is the reason a recipe book never gets filled in, so this
 * exists to get past that. It reads and structures; it does no arithmetic. The
 * amounts come back exactly as written on the page, and every one of them
 * lands in an editable field for the cook to check before saving. Nothing is
 * saved from here.
 */

/**
 * What the vision API itself accepts. HEIC is deliberately absent: iOS
 * converts to JPEG on upload, so a phone photo arrives fine, and pretending to
 * accept HEIC would only fail further in.
 */
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];

function isAllowedType(value: string): value is AllowedType {
  return (ALLOWED_TYPES as readonly string[]).includes(value);
}
const MAX_BYTES = 8_000_000;

const SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", description: "The dish name as written." },
    serves: {
      type: "integer",
      description: "How many the amounts feed. 0 if the page doesn't say.",
    },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        properties: {
          item: {
            type: "string",
            description:
              "The ingredient alone, with no amount in it. 'Bacon', never 'Bacon: 225g'.",
          },
          qty: { type: "number", description: "The number only." },
          unit: {
            type: "string",
            description: "g, kg, ml, L or ea. Convert imperial to metric.",
          },
          category: {
            type: "string",
            enum: [
              "Meat/Seafood",
              "Produce",
              "Dairy",
              "Dry goods",
              "Packaging",
              "Drinks",
            ],
          },
        },
        required: ["item", "qty", "unit", "category"],
        additionalProperties: false,
      },
    },
    method: {
      type: "string",
      description: "The method as written, or an empty string if there isn't one.",
    },
    unreadable: {
      type: "array",
      items: { type: "string" },
      description:
        "Anything you could not read with confidence, so the cook knows to check it.",
    },
  },
  required: ["name", "serves", "ingredients", "method", "unreadable"],
  additionalProperties: false,
} as const;

const SYSTEM = `You read photographs of recipes and return them as structured data.

The amount always goes in qty and unit, never in the ingredient name. "Bacon: 225g"
is wrong; item "Bacon", qty 225, unit "g" is right. A recipe whose amounts are stuck
in the names cannot be scaled, which defeats the point of entering it.

Convert imperial to metric: 1 lb = 454 g, 1 oz = 28 g, 1 cup of liquid = 250 ml.
Leave spoon measures for spices out of the ingredient list — they belong in the
method as pantry items, because nobody orders 3 tsp of paprika.

Use "ea" for things counted rather than weighed: eggs, onions, lemons, pastry sheets.

If the photo does not say how many it serves, return 0 rather than guessing.
Put anything you could not read confidently into "unreadable" — a wrong number a
cook trusts is worse than a gap they can see.

If the image is not a recipe, return an empty ingredients array.`;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let mediaType: string;
  let base64: string;
  try {
    const body = (await request.json()) as {
      mediaType?: unknown;
      data?: unknown;
    };
    mediaType = typeof body.mediaType === "string" ? body.mediaType : "";
    base64 = typeof body.data === "string" ? body.data : "";
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  if (!isAllowedType(mediaType)) {
    return NextResponse.json(
      { error: "That file isn't a photo the reader can open. Use a JPEG or PNG." },
      { status: 400 },
    );
  }
  // base64 runs about 4 characters per 3 bytes.
  if (!base64 || (base64.length * 3) / 4 > MAX_BYTES) {
    return NextResponse.json(
      { error: "That photo is too big. Take it again at a smaller size." },
      { status: 400 },
    );
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 8000,
      system: SYSTEM,
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            { type: "text", text: "Read this recipe." },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "Couldn't read that photo. Type the recipe in instead." },
        { status: 422 },
      );
    }

    const text = response.content.find((block) => block.type === "text");
    if (!text) {
      return NextResponse.json(
        { error: "Couldn't read that photo. Type the recipe in instead." },
        { status: 422 },
      );
    }

    const parsed = JSON.parse(text.text) as {
      name: string;
      serves: number;
      ingredients: unknown[];
      method: string;
      unreadable: string[];
    };

    if (parsed.ingredients.length === 0) {
      return NextResponse.json(
        {
          error:
            "No ingredients found in that photo. Check it's the right page and that the list is in frame.",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({ recipe: parsed });
  } catch (error) {
    console.error("read-recipe-photo failed", error);
    return NextResponse.json(
      {
        error:
          "Reading photos is unavailable right now. Paste the ingredients in instead — the rest of the form works.",
      },
      { status: 502 },
    );
  }
}
