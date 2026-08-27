import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server.ts";

/**
 * Turn a spoken stocktake into stock lines.
 *
 * Counting a coolroom is a two-handed job. You are moving boxes, and the thing
 * you cannot do while moving boxes is type. So you talk — "two boxes of roma
 * tomatoes, about four kilos of brisket in the chest freezer, half a bag of
 * plain flour" — and this turns it into rows.
 *
 * The words are recognised by the browser for free; only the structuring
 * happens here. Nothing is saved: every line lands in a review list to be
 * checked first, same as the invoice reader.
 *
 * The rule that matters: an amount that wasn't said is not invented. "Some
 * carrots" is a real thing to say during a stocktake and a real thing to be
 * unsure about later, so it comes back flagged rather than as a number
 * somebody made up.
 */

const MIN_CHARS = 8;
const MAX_CHARS = 6000;

const SCHEMA = {
  type: "object",
  properties: {
    lines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          item: {
            type: "string",
            description:
              "The ingredient in plain words, with no amount in it. 'Roma tomatoes', never '2 boxes roma tomatoes'.",
          },
          qty: {
            type: "number",
            description:
              "How much there is, as a number in the unit below. 0 when no amount was said.",
          },
          unit: {
            type: "string",
            description:
              "kg, g, L, ml, ea, boxes, bags, trays, punnets, bunches — whatever they counted in. Do not convert.",
          },
          place: {
            type: "string",
            description:
              "Where it is, if they said: 'chest freezer', 'dry store', 'coolroom', 'van'. Empty string otherwise.",
          },
          unclear: {
            type: "string",
            description:
              "Empty string when the line is plain. Otherwise what you were unsure about, in words a cook can act on.",
          },
        },
        required: ["item", "qty", "unit", "place", "unclear"],
        additionalProperties: false,
      },
    },
    notes: {
      type: "array",
      items: { type: "string" },
      description:
        "Anything about the stocktake as a whole worth saying — a stretch you couldn't follow, a place mentioned once and then assumed.",
    },
  },
  required: ["lines", "notes"],
  additionalProperties: false,
} as const;

const SYSTEM = `You turn a caterer counting their pantry out loud into structured stock lines.

They are walking a shelf or a coolroom with their hands full, so the speech
rambles, backtracks and corrects itself. Follow the corrections: "three boxes of
tomatoes, no, two" is two boxes.

Keep the unit they counted in. A cook says "two boxes" or "half a bag" because
that is what is in front of them, and a box is not a fixed weight. Report boxes.
Do not convert to kilos and do not guess what a box weighs — the app reconciles
units later, and where it can't it says so, which is the honest outcome.

Fractions spoken as words are numbers: "half a bag" is qty 0.5, unit bags. "A
couple of trays" is 2 trays. "A dozen eggs" is qty 12, unit ea.

If they name an amount with no unit — "about six onions" — use ea.

If they name no amount at all — "some carrots", "a bit of parsley left" — set
qty to 0 and say in that line's "unclear" that no amount was given. Never
invent one. A pantry count that quietly turns "some" into a number is how a
caterer turns up to a job short.

Where something is kept carries forward until they say otherwise: "in the chest
freezer I've got brisket and lamb" puts both in the chest freezer. If they never
say, leave place empty.

Skip anything that isn't stock — thinking aloud, notes to self, what they need
to order, what they used last week.

If none of it is a stocktake, return an empty lines array.`;

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Voice notes aren't switched on for this site yet — it needs an ANTHROPIC_API_KEY in the Vercel project settings. Until then, type the count in instead.",
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
      { error: "That's too short to read. Say the thing and how much of it." },
      { status: 400 },
    );
  }
  if (transcript.length > MAX_CHARS) {
    return NextResponse.json(
      { error: "That's a long count. Do it in two goes — one room at a time." },
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
        { role: "user", content: `Here is what they said:\n\n${transcript}` },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "Couldn't read that one. Type the count in instead." },
        { status: 422 },
      );
    }

    const text = response.content.find((block) => block.type === "text");
    if (!text) {
      return NextResponse.json(
        { error: "Couldn't read that one. Type the count in instead." },
        { status: 422 },
      );
    }

    const parsed = JSON.parse(text.text) as {
      lines: unknown[];
      notes: string[];
    };

    if (parsed.lines.length === 0) {
      return NextResponse.json(
        {
          error:
            "Nothing in that sounded like a stocktake. Try naming the thing and how much of it — “two boxes of tomatoes, four kilos of brisket”.",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({ stocktake: parsed });
  } catch (error) {
    console.error("read-stock-voice failed", error);
    return NextResponse.json(
      {
        error:
          "Reading voice notes is unavailable right now. Type the count in instead — the rest of the page works.",
      },
      { status: 502 },
    );
  }
}
