import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server.ts";

/**
 * Read a supplier invoice or docket into price-list lines.
 *
 * This is where the price list stops being a thing you maintain by hand.
 * Photograph the docket from the butcher and what you actually paid — at
 * wholesale, from your own supplier — becomes the price the order sheet costs
 * against. No retail shelf price is ever the right number for a caterer.
 *
 * It reads and structures; it does no arithmetic on the money beyond copying
 * what's printed. Working out a per-kilo price from a line total happens in
 * lib/price-change.ts, where it can be tested. Nothing here is saved — every
 * line lands in a review table for the cook to check first.
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
    supplier: {
      type: "string",
      description: "Who the invoice is from. Empty string if it doesn't say.",
    },
    invoiceDate: {
      type: "string",
      description: "The invoice date as YYYY-MM-DD. Empty string if not shown.",
    },
    lines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          item: {
            type: "string",
            description:
              "The ingredient in plain words, with no amount, code or pack size in it. 'Beef brisket', never 'BRISKET PR 12.5KG' or '4001 BRISKET'.",
          },
          qty: {
            type: "number",
            description:
              "How much was billed, as a number in the unit below. The total weight or count for the line, not the pack size.",
          },
          unit: {
            type: "string",
            description: "kg, g, L, ml, ea, bunches, punnets, trays or boxes.",
          },
          lineTotal: {
            type: "number",
            description:
              "What the whole line cost in dollars, excluding GST if the invoice separates it.",
          },
          unclear: {
            type: "string",
            description:
              "Empty string when the line is plain. Otherwise what you were unsure about, in words a cook can act on.",
          },
        },
        required: ["item", "qty", "unit", "lineTotal", "unclear"],
        additionalProperties: false,
      },
    },
    notes: {
      type: "array",
      items: { type: "string" },
      description:
        "Anything about the invoice as a whole worth saying — unreadable sections, a total that doesn't add up, GST treatment that isn't obvious.",
    },
  },
  required: ["supplier", "invoiceDate", "lines", "notes"],
  additionalProperties: false,
} as const;

const SYSTEM = `You read supplier invoices and delivery dockets from food wholesalers, butchers, greengrocers and dry goods suppliers, and return the priced lines as structured data.

Give the ingredient a name a cook would search for. Supplier codes, pack
abbreviations and case are noise: "BRISKET PR VAC 12.5KG" is "Beef brisket",
"CHKN THIGH BNLS SKINLSS" is "Chicken thigh, boneless".

qty is the total billed amount for that line, in the unit you report. If a line
reads "4 x 3kg", that is 12 kg, not 4. If it reads "6 x 500ml", that is 3000 ml.
Get this right — a per-unit price is worked out by dividing the line total by
this number, so a pack count in here makes the price wrong by the pack size.

lineTotal is what that line cost. If the invoice shows both ex-GST and inc-GST
amounts, use the ex-GST one and say so in notes. If it only shows one, use it.

Only return lines that are food or ingredients with a price. Skip delivery
fees, pallet charges, credits, subtotals and the invoice total.

Put anything you are unsure about in that line's "unclear" — a smudged number,
a unit you had to infer, a pack size you read as a multiplication. A wrong price
a caterer trusts goes straight into a quote, so an uncertain line that says so
is worth far more than a confident guess.

If the image is not an invoice or docket, return an empty lines array.`;

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Reading invoices isn't switched on for this site yet — it needs an ANTHROPIC_API_KEY in the Vercel project settings. Until then, type the prices in instead.",
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
            { type: "text", text: "Read this invoice." },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "Couldn't read that invoice. Type the prices in instead." },
        { status: 422 },
      );
    }

    const text = response.content.find((block) => block.type === "text");
    if (!text) {
      return NextResponse.json(
        { error: "Couldn't read that invoice. Type the prices in instead." },
        { status: 422 },
      );
    }

    const parsed = JSON.parse(text.text) as {
      supplier: string;
      invoiceDate: string;
      lines: unknown[];
      notes: string[];
    };

    if (parsed.lines.length === 0) {
      return NextResponse.json(
        {
          error:
            "No priced lines found. Check the whole docket is in frame and the amounts are readable.",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({ invoice: parsed });
  } catch (error) {
    console.error("read-invoice failed", error);
    return NextResponse.json(
      {
        error:
          "Reading invoices is unavailable right now. Type the prices in instead — the rest of the page works.",
      },
      { status: 502 },
    );
  }
}
