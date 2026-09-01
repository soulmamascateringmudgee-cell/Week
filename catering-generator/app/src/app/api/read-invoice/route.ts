import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import { MAX_PAGES, collectPages, faultInPages, pageLabel } from "@/lib/pages.ts";
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

/**
 * A receipt arrives as a photo or as the PDF the supplier emailed. Both are
 * "upload a receipt" to the person holding it, so both are read here.
 */
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

function isImageType(value: string): value is ImageType {
  return (IMAGE_TYPES as readonly string[]).includes(value);
}

function isAllowedType(value: string): boolean {
  return isImageType(value) || value === "application/pdf";
}

/**
 * Ceilings on a whole upload, not on one photo.
 *
 * Images are shrunk in the browser before they get here, so these are
 * backstops rather than the usual path. A set of photos gets more room than a
 * single one did, because a long receipt genuinely is several — but not eight
 * times as much, since each is a page rather than a poster.
 *
 * PDFs keep the larger allowance: the API takes 32 MB of document, and a
 * scanned multi-page invoice is legitimately bigger than a photo of one.
 */
const MAX_IMAGE_BYTES = 24_000_000;
const MAX_PDF_BYTES = 30_000_000;

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

/**
 * A supermarket receipt is not a wholesale docket, and reading it as one gets
 * the quantities wrong.
 *
 * A docket has a quantity column. A Woolworths receipt mostly doesn't: the
 * amount lives inside the product name ("MILK FC 2L  $3.10"), which is exactly
 * the noise the wholesale prompt is told to strip out. Loose produce is the
 * other way round, printing its own weight and per-kilo rate on a second line.
 * Then there are discount lines, loyalty lines and a GST summary that means
 * something different when most of a caterer's basket is GST-free fresh food.
 *
 * So it gets its own instructions rather than a shared prompt with caveats.
 */
const RECEIPT_SYSTEM = `You read Australian supermarket receipts — Woolworths, Coles, Aldi, IGA — and return the food lines as structured data.

Give the ingredient a name a cook would search for, with the brand and the pack
size taken out. "WW CARROTS 1KG" is "Carrots". "MILK FC 2L" is "Full cream
milk". "COL RSP CHKN THIGH" is "Chicken thigh".

qty is the total amount that line bought, in the unit you report, and on a
receipt it comes from one of two places:

  The pack size in the product name. "MILK FC 2L $3.10" is qty 2, unit L.
  "CARROTS 1KG $2.50" is qty 1, unit kg. "EGGS FREE RANGE 12PK $6.50" is
  qty 12, unit ea. If a line is a multiple — "2 @ $3.10" above or beside a
  2 L milk — that is 4 L in total, not 2.

  The weighed line. Loose produce prints its own weight and rate, like
  "BROCCOLI 0.512kg NET @ $7.90/kg   $4.04". qty is 0.512, unit kg.

If a line names no amount at all — "LETTUCE ICEBERG  $3.90" — report qty 1 and
unit ea. Do not invent a weight for it. Say so in that line's "unclear".

lineTotal is what was actually paid for that line. If a discount or special is
printed against the line, use the price after it. If a discount appears as its
own separate line, subtract it from the line it belongs to where the receipt
makes that obvious, and note it; otherwise leave both and say so in notes.

Skip anything that is not food or a food ingredient: bags, loyalty points,
rounding, subtotals, the GST summary, the total, the payment lines. Also skip
non-food grocery — cleaning products, pet food, toiletries.

Australian supermarket prices are shown GST-inclusive, and most fresh food is
GST-free. Report the printed price. Do not try to strip GST out.

supplier is the shop: "Woolworths", "Coles", "Aldi", "IGA". Take it from the
receipt header. If the header is cut off or unreadable, use an empty string
rather than guessing from the layout.

You may be given several photos. They are sections of ONE receipt, in order,
because a supermarket receipt for a catering shop is longer than one photograph
can hold and still be readable. Treat them as a single receipt:

  Report each purchase ONCE. Consecutive photos of a long receipt usually
  overlap — the last few lines of one are the first few of the next — and the
  same line appearing twice is the same purchase, not two of them. Getting this
  wrong doubles what a job appears to have cost.

  A line can be split across the break, with the item name at the bottom of one
  photo and its price at the top of the next. Put it back together rather than
  reporting two half-lines.

  Where you genuinely cannot tell whether two similar lines are one purchase
  photographed twice or two separate purchases of the same thing, report one
  and say so in its "unclear".

  The header is usually only on the first photo and the total only on the last.
  That is normal and not something to note.

Put anything you are unsure about in that line's "unclear" — an abbreviation
you had to expand, a pack size you inferred, a weight you couldn't read, a
discount you weren't sure applied. A wrong price a caterer trusts goes straight
into a quote, so an uncertain line that says so is worth far more than a
confident guess.

If the image is not a receipt, return an empty lines array.`;

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

You may be given several photos or pages. They are ONE invoice, in order. Treat
them as a single document: report each billed line once even where consecutive
photos overlap, and rejoin a line split across the break rather than reporting
two half-lines. The header is usually only on the first page and the total only
on the last.

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  // Anything other than an explicit "receipt" reads as a wholesale docket,
  // which is what every existing caller sends.
  const isReceipt =
    typeof body === "object" &&
    body !== null &&
    (body as { kind?: unknown }).kind === "receipt";

  // Every message the cook sees should name the thing they photographed.
  const noun = isReceipt ? "receipt" : "invoice";

  const pages = collectPages(body);
  const hasPdf = pages.some((page) => page.mediaType === "application/pdf");
  const fault = faultInPages(pages, {
    isAllowedType,
    maxBytes: hasPdf ? MAX_PDF_BYTES : MAX_IMAGE_BYTES,
  });

  if (fault) {
    // Each of these is something the cook can act on, so each says what to do
    // rather than reporting that a check failed.
    const said = {
      empty: `Nothing came through to read. Choose a photo or PDF of the ${noun}.`,
      "too-many": `That's ${fault.kind === "too-many" ? fault.count : 0} photos — more than the ${MAX_PAGES} this can read at once. Send the longest receipt in two goes, or use the supplier's PDF.`,
      type: "One of those files isn't something the reader can open. Use photos or a PDF.",
      "too-big": hasPdf
        ? "That PDF is too big to read. Send just the pages with the prices on them."
        : "Those photos are too big altogether, even after shrinking. Send them in two goes.",
    }[fault.kind];
    return NextResponse.json({ error: said }, { status: 400 });
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 8000,
      system: isReceipt ? RECEIPT_SYSTEM : SYSTEM,
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: [
            // Each page is announced by name before it appears, so the reader
            // knows which photo it's looking at and in what order. Every page
            // goes into one message rather than one request each: a line split
            // across a photo boundary can only be rejoined by something
            // holding both halves at once.
            ...pages.flatMap((page, index) => {
              const label = pageLabel(index, pages.length);
              const block =
                page.mediaType === "application/pdf"
                  ? {
                      type: "document" as const,
                      source: {
                        type: "base64" as const,
                        media_type: "application/pdf" as const,
                        data: page.data,
                      },
                    }
                  : {
                      type: "image" as const,
                      source: {
                        type: "base64" as const,
                        media_type: page.mediaType as ImageType,
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
                  ? `Read this ${noun}.`
                  : `Those ${pages.length} photos are one ${noun}. Read it.`,
            },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: `Couldn't read that ${noun}. Type the prices in instead.` },
        { status: 422 },
      );
    }

    const text = response.content.find((block) => block.type === "text");
    if (!text) {
      return NextResponse.json(
        { error: `Couldn't read that ${noun}. Type the prices in instead.` },
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
            `No priced lines found. Check the whole ${noun} is in frame and the amounts are readable.`,
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
