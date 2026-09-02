import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import { MAX_PAGES, collectPages, faultInPages, pageLabel } from "@/lib/pages.ts";
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
 * What the vision API itself accepts.
 *
 * HEIC is deliberately absent, and the browser is why it can be. An iPhone
 * photo is HEIC, which would be rejected here for a reason nobody could act on
 * — so the page redraws every picture as a JPEG before sending it. Accepting
 * HEIC at this end would only move the failure somewhere less explicable.
 */
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];

function isAllowedType(value: string): value is AllowedType {
  return (ALLOWED_TYPES as readonly string[]).includes(value);
}

/** A ceiling on the whole upload. Photos are shrunk before they get here. */
const MAX_BYTES = 24_000_000;

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
          section: {
            type: "string",
            description:
              "The heading this ingredient sits under on the page — 'Dry', 'Wet', 'For the marinade'. Empty string when the page has no headings.",
          },
        },
        required: ["item", "qty", "unit", "category", "section"],
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

Recipes are often written in parts, with headings over blocks of ingredients:
"Dry", "Wet", "For the marinade", "Topping". Put that heading in "section" on
every ingredient under it, word for word as the page has it, and never as an
ingredient of its own. A page with no headings gets an empty section on every
line — do not invent parts the cook did not write.

If the photo does not say how many it serves, return 0 rather than guessing.
Put anything you could not read confidently into "unreadable" — a wrong number a
cook trusts is worse than a gap they can see.

You may be given several photos. They are pages or parts of ONE recipe, in
order — a page and its overleaf, a card photographed in halves, a method that
runs past where the ingredients stop. Treat them as a single recipe:

  List each ingredient once. Photos of a long list usually overlap, and the
  same ingredient appearing in two of them is one ingredient, not two.

  An ingredient can be split across the break, with its amount at the bottom of
  one photo and its name at the top of the next. Put it back together.

  Take the dish name and the serves from wherever they appear, usually the
  first photo. Join the method into one set of steps in the order given.

If the image is not a recipe, return an empty ingredients array.`;

export async function POST(request: Request) {
  // Without a key the SDK throws something about authentication methods, which
  // tells a cook nothing. Say what is actually missing and who fixes it.
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Reading photos isn't switched on for this site yet — it needs an ANTHROPIC_API_KEY in the Vercel project settings. Until then, paste the ingredients in instead.",
      },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const pages = collectPages(body);
  const fault = faultInPages(pages, { isAllowedType, maxBytes: MAX_BYTES });

  if (fault) {
    const said = {
      empty: "Nothing came through to read. Choose a photo of the recipe.",
      "too-many": `That's ${fault.kind === "too-many" ? fault.count : 0} photos — more than the ${MAX_PAGES} this can read at once. Do the recipe in two goes.`,
      type: "One of those files isn't a photo the reader can open. Use a JPEG or PNG.",
      "too-big":
        "Those photos are too big altogether. Send them in two goes, or take fewer.",
    }[fault.kind];
    return NextResponse.json({ error: said }, { status: 400 });
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
            // All the pages in one message, each announced before it appears.
            // An ingredient whose amount is on one page and whose name is on
            // the next can only be rejoined by a reader holding both.
            ...pages.flatMap((page, index) => {
              const label = pageLabel(index, pages.length);
              const block = {
                type: "image" as const,
                source: {
                  type: "base64" as const,
                  media_type: page.mediaType as AllowedType,
                  data: page.data,
                },
              };
              return label
                ? [{ type: "text" as const, text: label }, block]
                : [block];
            }),
            {
              type: "text" as const,
              text:
                pages.length === 1
                  ? "Read this recipe."
                  : `Those ${pages.length} photos are one recipe. Read it.`,
            },
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
