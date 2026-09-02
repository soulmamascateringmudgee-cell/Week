import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server.ts";

/**
 * Turn a spoken recipe into the fields the form wants.
 *
 * The transcript arrives from the browser's own speech recognition — this
 * route never touches audio. That keeps the whole feature on the one API key
 * the app already has, and means nothing of the cook's voice leaves their
 * device.
 *
 * Spoken recipes are not written ones. Numbers arrive as words ("two kilos"),
 * amounts are vague ("a good handful"), and the recogniser mishears. So this
 * structures what it heard and, crucially, reports what it was unsure about
 * rather than smoothing it over. Every field lands editable; nothing is saved
 * from here.
 */

const MIN_CHARS = 15;
const MAX_CHARS = 12_000;

const SCHEMA = {
  type: "object",
  properties: {
    name: {
      type: "string",
      description: "The dish name. Empty string if they never said one.",
    },
    serves: {
      type: "integer",
      description: "How many the amounts feed. 0 if they didn't say.",
    },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        properties: {
          item: {
            type: "string",
            description:
              "The ingredient alone, with no amount in it. 'Bacon', never '225g bacon'.",
          },
          qty: { type: "number", description: "The number only." },
          unit: {
            type: "string",
            description: "g, kg, ml, L, bunches or ea.",
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
              "The part of the dish they said this belongs to — 'Dry', 'Wet', 'Marinade'. Empty string when they didn't split the dish up.",
          },
        },
        required: ["item", "qty", "unit", "category", "section"],
        additionalProperties: false,
      },
    },
    method: {
      type: "string",
      description:
        "Any method they described, tidied into sentences. Empty string if none.",
    },
    unclear: {
      type: "array",
      items: { type: "string" },
      description:
        "Anything vague, misheard-sounding, or guessed at, in plain words the cook can act on.",
    },
  },
  required: ["name", "serves", "ingredients", "method", "unclear"],
  additionalProperties: false,
} as const;

const SYSTEM = `You turn a caterer talking through a recipe from memory into structured data.

This is speech, not writing. Expect no punctuation, false starts, corrections
mid-sentence ("two kilos of beef, no, make that three"), and numbers spoken as
words. Take the last thing they said when they correct themselves.

The amount always goes in qty and unit, never in the ingredient name. "225g bacon"
is wrong; item "Bacon", qty 225, unit "g" is right. A recipe whose amounts are
stuck in the names cannot be scaled, which defeats the point of entering it.

Use "ea" for things counted rather than weighed — eggs, onions, lemons — and
"bunches" for herbs and greens sold that way.

Leave spoon measures for spices out of the ingredient list. They belong in the
method as pantry items, because nobody orders 3 tsp of paprika.

Cooks speak in rough amounts. Convert the ones with a settled meaning: a dozen is
12, half a kilo is 500 g, a couple is 2. For genuinely vague ones — a handful, a
splash, a good glug, some — put your best number in qty and say so in "unclear".
Never silently invent a number.

Speech recognition mishears. Say so when a line reads like a mishearing, in the
cook's own terms: "Heard 'four salt' — did you mean flour and salt?" beats a note
about transcription confidence.

Cooks talk a recipe through in parts: "so the dry stuff is…", "then for the
marinade…". Put that part in "section" on every ingredient they name under it,
in their own words, and never as an ingredient of its own. Leave it empty when
they simply listed a dish straight through — do not split a dish up for them.

If they never said how many it serves, return 0 rather than guessing.

If the transcript isn't someone describing a recipe, return an empty ingredients
array.`;

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Voice notes aren't switched on for this site yet — it needs an ANTHROPIC_API_KEY in the Vercel project settings. Until then, type the ingredients in instead.",
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

  let transcript: string;
  try {
    const body = (await request.json()) as { transcript?: unknown };
    transcript =
      typeof body.transcript === "string" ? body.transcript.trim() : "";
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  if (transcript.length < MIN_CHARS) {
    return NextResponse.json(
      { error: "That's too short to read. Say the dish and its ingredients." },
      { status: 400 },
    );
  }
  if (transcript.length > MAX_CHARS) {
    return NextResponse.json(
      { error: "That's a long one. Do it in two goes — one dish at a time." },
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
          content: `Here is what they said:\n\n${transcript}`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "Couldn't read that one. Type the recipe in instead." },
        { status: 422 },
      );
    }

    const text = response.content.find((block) => block.type === "text");
    if (!text) {
      return NextResponse.json(
        { error: "Couldn't read that one. Type the recipe in instead." },
        { status: 422 },
      );
    }

    const parsed = JSON.parse(text.text) as {
      name: string;
      serves: number;
      ingredients: unknown[];
      method: string;
      unclear: string[];
    };

    if (parsed.ingredients.length === 0) {
      return NextResponse.json(
        {
          error:
            "No ingredients in that one. Say the dish, then the amounts — “slow-cooked brisket for twenty, five kilos of brisket, two onions…”",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({ recipe: parsed });
  } catch (error) {
    console.error("read-recipe-voice failed", error);
    return NextResponse.json(
      {
        error:
          "Voice notes are unavailable right now. Type the ingredients in instead — the rest of the form works.",
      },
      { status: 502 },
    );
  }
}
