import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import {
  MAX_INGREDIENTS,
  checkParts,
  collectItems,
  partsPrompt,
} from "@/lib/parts-suggestion.ts";
import { createClient } from "@/lib/supabase/server.ts";

/**
 * Propose which part of a dish each ingredient belongs to.
 *
 * A recipe written in parts — an apple filling and a crumble topping, a dry
 * bowl and a wet bowl, a marinade and the thing it goes on — arrives here as
 * one flat list, because that is what most sites publish. Two lots of flour,
 * one after the other, with nothing on the page to say where the first part
 * ends. A cook reading that has to work the parts out again at the bench, from
 * a sheet that looks like it already knows.
 *
 * The parts are usually sitting in the method: "Apple filling – place the
 * apples in a bowl", "Crumble topping – place the topping ingredients in a
 * bowl". Reading them off it is a job for a model, not a regular expression:
 * the second of those two lines names no ingredient at all, and in half the
 * book "cream" is a verb before it is a thing.
 *
 * So this proposes and nothing more. It returns a heading per line, in order,
 * into the form's own Part boxes, where the cook reads them and either saves
 * or changes them. Three rules make that safe to offer:
 *
 *   It never sees or returns an amount. Only labels move.
 *   It returns one entry per ingredient, in the order given, or the caller
 *   rejects the lot — a grouping that slips by one line would file the wrong
 *   flour under the wrong heading, which is worse than no headings at all.
 *   It leaves a line blank when the recipe doesn't say, rather than inventing
 *   a part to put it in.
 *
 * Nothing is saved from here.
 */

const SCHEMA = {
  type: "object",
  properties: {
    parts: {
      type: "array",
      description:
        "One entry per ingredient, in the order given. Empty string when the recipe doesn't say which part it belongs to.",
      items: { type: "string" },
    },
    reason: {
      type: "string",
      description:
        "One short sentence on where the parts came from, or why there are none.",
    },
  },
  required: ["parts", "reason"],
  additionalProperties: false,
} as const;

const SYSTEM = `You file a recipe's ingredients into the parts the recipe is written in.

You are given a dish name, its method, and its ingredient list in order. Return
one heading per ingredient, in the same order, as "parts".

Where the headings come from, in this order of preference:

  The method's own names for its parts. "Apple filling – place the apples in a
  bowl", "CRUMBLE TOPPING: mix until it clumps", "For the marinade". Use the
  cook's words, tidied to sentence case: "Apple filling", "Crumble topping".

  The obvious structure of the dish when the method names it plainly — a
  dressing, a sauce, a topping, a marinade that is clearly separate from the
  thing it goes on.

Rules that matter more than coverage:

  Return exactly one entry for every ingredient given, in the order given. Never
  add, drop, reorder or reword an ingredient. You are only labelling them.

  An ingredient the recipe does not clearly place gets an empty string. A wrong
  heading is worse than no heading: it sends a cook to the bench with the wrong
  flour in the wrong bowl, and it looks just as confident as a right one.

  If the recipe is one pot with no parts at all, return an empty string for
  every ingredient. Most recipes are. "Dry" and "Wet" are only parts when the
  recipe actually mixes them separately — do not impose them on a dish that
  just has some dry things and some wet things in it.

  The same ingredient can appear twice in different parts, and often does —
  flour in a filling and flour in a topping. That is the case this exists for.
  Give each occurrence the part it belongs to.

  Use at most a handful of parts, and use the same wording for every line in a
  part. "Crumble topping" on one line and "Topping" on the next makes two parts
  out of one.`;

interface Body {
  name?: unknown;
  method?: unknown;
  ingredients?: unknown;
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Suggesting parts isn't switched on for this site yet — it needs an ANTHROPIC_API_KEY in the Vercel project settings. Until then, type the parts in yourself.",
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

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const items = collectItems(body.ingredients);
  if (items === null || items.length === 0) {
    return NextResponse.json(
      { error: "Add the ingredients first, then ask for parts." },
      { status: 400 },
    );
  }
  if (items.length > MAX_INGREDIENTS) {
    return NextResponse.json(
      { error: `That's more than ${MAX_INGREDIENTS} ingredients — too long to sort.` },
      { status: 400 },
    );
  }

  const method = typeof body.method === "string" ? body.method.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";

  // Without a method there is nothing to read the parts off, and a model asked
  // to group a bare list will group it by kind — every dry thing together —
  // which is a plausible-looking answer to a question the recipe never asked.
  if (method === "") {
    return NextResponse.json(
      {
        error:
          "This recipe has no method, and the parts come from the method. Add the steps, or type the parts in yourself.",
      },
      { status: 422 },
    );
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 4000,
      system: SYSTEM,
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: partsPrompt(name, method, items) },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "Couldn't sort that one into parts. Type them in yourself." },
        { status: 422 },
      );
    }

    const text = response.content.find((block) => block.type === "text");
    if (!text) {
      return NextResponse.json(
        { error: "Couldn't sort that one into parts. Type them in yourself." },
        { status: 422 },
      );
    }

    const parsed = JSON.parse(text.text) as { parts: unknown; reason?: unknown };

    // One heading per ingredient or none at all. A list that came back short
    // would be applied from the top and file every line after the gap under
    // its neighbour's heading — the wrong flour in the wrong bowl, silently.
    const parts = checkParts(parsed.parts, items.length);
    if (parts === null) {
      return NextResponse.json(
        {
          error:
            "The parts that came back didn't line up with the ingredients, so nothing has been changed. Try again, or type them in yourself.",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      parts,
      reason: typeof parsed.reason === "string" ? parsed.reason : "",
    });
  } catch (error) {
    console.error("suggest-parts failed", error);
    return NextResponse.json(
      {
        error:
          "Suggesting parts is unavailable right now. Type them in yourself — the rest of the form works.",
      },
      { status: 502 },
    );
  }
}
