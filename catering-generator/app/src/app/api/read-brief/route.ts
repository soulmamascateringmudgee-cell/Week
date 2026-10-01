import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import { readBrief } from "@/lib/brief.ts";
import { DIETARY_LABELS } from "@/lib/options.ts";
import { MAX_PAGES, collectPages, faultInPages, pageLabel } from "@/lib/pages.ts";
import { createClient } from "@/lib/supabase/server.ts";

/**
 * Read a brief — a chat, an email, a run sheet, a photographed scrap of paper —
 * into a job proposal.
 *
 * Nothing is saved here. The route reads and structures; the page shows the
 * result field by field and the operator confirms it. Everything it hands back
 * goes through `lib/brief.ts`, which refuses anything the form can't hold and
 * discards any dish the model claims is one of hers without it being in her
 * recipe book.
 *
 * The recipe book is read first and sent with the brief. That is what lets
 * "the brisket" in a client's email become the dish she costed in March,
 * rather than a new line nobody has a price for. It is sent as names only:
 * the ingredients and method never leave the database for this.
 */

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

function isImageType(value: string): value is ImageType {
  return (IMAGE_TYPES as readonly string[]).includes(value);
}

function isAllowedType(value: string): boolean {
  return isImageType(value) || value === "application/pdf";
}

const MAX_IMAGE_BYTES = 24_000_000;
const MAX_PDF_BYTES = 30_000_000;

/**
 * How much pasted text this will read at once.
 *
 * A whole planning chat is genuinely long — this is roughly a hundred pages of
 * conversation, which is more than anyone works a single job out in. Past it
 * the answer is to paste the part about the job, not to send more.
 */
const MAX_TEXT = 120_000;

/** Enough of her book for matching; a caterer with more than this has bigger problems. */
const MAX_RECIPE_NAMES = 500;

const SCHEMA = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description:
        "A short name for this job, the way the brief refers to it: \"Taylor wedding, Burnbrae\". Empty string if the brief doesn't name it.",
    },
    client: {
      type: "string",
      description: "Who the job is for. Empty string if not stated.",
    },
    venue: {
      type: "string",
      description: "Where it happens. Empty string if not stated.",
    },
    guests: {
      type: "integer",
      description:
        "How many people are being fed. 0 if the brief does not say. Never work this out from a quantity of food — a brief that orders 12 kg of brisket has not told you the headcount.",
    },
    eventDate: {
      type: "string",
      description:
        "The day of the event as YYYY-MM-DD. Empty string if the brief does not give a date you can pin down.",
    },
    style: {
      type: "string",
      enum: ["shared", "plated", "grazing", "van", "multiday", ""],
      description:
        "How the food is served. shared = shared table / long table / family style. plated = plated courses to seats. grazing = grazing table, canapés, roaming. van = food van, street food, walk-up service. multiday = a retreat or camp over several days. Empty string if the brief doesn't say.",
    },
    menuWeight: {
      type: "string",
      enum: ["light", "standard", "feasting", ""],
      description:
        "How much food. light = daytime, lunch, light. standard = an ordinary dinner. feasting = a big feast, long table, abundance asked for by name. Empty string if the brief doesn't say.",
    },
    serviceWindowHours: {
      type: "number",
      description:
        "How many hours food is being served for, if the brief says or gives times you can subtract. 0 if not.",
    },
    budget: {
      type: "number",
      description:
        "Total FOOD budget in dollars, if the brief gives one. 0 if not. A per-head price or a total quote including labour and hire is not a food budget — use 0 and say so in unclear.",
    },
    drinksService: {
      type: "string",
      enum: ["yes", "no", ""],
      description:
        "yes if the brief says drinks are being served or poured by the crew, no if it says explicitly they are not, empty string if it doesn't say.",
    },
    hotOrOutdoors: {
      type: "string",
      enum: ["yes", "no", ""],
      description:
        "yes if the brief says it is outdoors, in a paddock, in summer heat or otherwise hot. no if it says explicitly indoors and climate controlled. Empty string if it doesn't say.",
    },
    dietaries: {
      type: "array",
      description:
        "Only requirements that match one of the allowed labels exactly. Anything else belongs in otherDietaries.",
      items: {
        type: "object",
        properties: {
          label: { type: "string", enum: [...DIETARY_LABELS] },
          count: {
            type: "integer",
            description: "How many people. 0 if the brief names the requirement without a number.",
          },
        },
        required: ["label", "count"],
        additionalProperties: false,
      },
    },
    otherDietaries: {
      type: "array",
      description:
        "Every dietary requirement, allergy or intolerance that is NOT one of the allowed labels, written out word for word as the brief put it, with the number of people if given. A shellfish allergy, coeliac disease by name, low FODMAP, halal, pregnancy, a named ingredient someone can't eat. Do not map these onto the allowed labels and do not leave them out.",
      items: { type: "string" },
    },
    dishes: {
      type: "array",
      description: "The menu, in the order the brief lists it.",
      items: {
        type: "object",
        properties: {
          asWritten: {
            type: "string",
            description: "The dish exactly as the brief writes it.",
          },
          recipe: {
            type: "string",
            description:
              "If this dish is one of the recipes in the list you were given, the recipe's name copied EXACTLY as it is spelled in that list. Empty string if none of them is this dish. Never write a name that is not in the list.",
          },
        },
        required: ["asWritten", "recipe"],
        additionalProperties: false,
      },
    },
    shifts: {
      type: "array",
      description:
        "Days of work the brief actually names — prep days, bump-in, service, pack-down. Do not invent a prep day the brief doesn't mention.",
      items: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "What the work is: \"Prep day\", \"Bump in and set up\", \"Service\", \"Pack down\".",
          },
          date: { type: "string", description: "YYYY-MM-DD." },
          startTime: {
            type: "string",
            description: "24-hour HH:MM. Empty string if the brief gives no start time.",
          },
          endTime: {
            type: "string",
            description: "24-hour HH:MM. Empty string if the brief gives no finish time.",
          },
          location: { type: "string", description: "Where. Empty string if not stated." },
          detail: {
            type: "string",
            description: "Anything the crew needs for that day, from the brief. Empty string if nothing.",
          },
          isPrep: {
            type: "boolean",
            description: "True for kitchen prep away from the event, false for anything on site.",
          },
        },
        required: ["title", "date", "startTime", "endTime", "location", "detail", "isPrep"],
        additionalProperties: false,
      },
    },
    crewNeeded: {
      type: "integer",
      description: "How many crew the brief says are needed. 0 if it doesn't say.",
    },
    unclear: {
      type: "array",
      description:
        "Everything you were unsure about or had to resolve, in plain words a cook can act on: a date you worked out from \"next Saturday\", a time written ambiguously, a headcount given as a range, a dish you couldn't match, a budget that included labour, anything in the brief that contradicts itself.",
      items: { type: "string" },
    },
  },
  required: [
    "title",
    "client",
    "venue",
    "guests",
    "eventDate",
    "style",
    "menuWeight",
    "serviceWindowHours",
    "budget",
    "drinksService",
    "hotOrOutdoors",
    "dietaries",
    "otherDietaries",
    "dishes",
    "shifts",
    "crewNeeded",
    "unclear",
  ],
  additionalProperties: false,
} as const;

const SYSTEM = `You read catering briefs and return the job as structured data. A brief might be an email from a client, a planner's run sheet, a photographed scrap of paper, or a long conversation with an AI assistant where a caterer worked the job out. Your reader is a working caterer in regional New South Wales, Australia.

Your one job is to report what the brief says. You are not planning the job and
not advising on it.

REPORT NOTHING THE BRIEF DOES NOT SAY. Every field has a way of saying "not
stated" — an empty string for text and for the yes/no fields, 0 for the numbers
— and using it is the correct answer, not a failure. A guessed headcount is
worse than a blank one: blank gets asked about, and a guess gets ordered
against. The same goes for a date, a service style and a budget.

Dates are Australian. 14/03 is 14 March, never 3 November. A date with no year
is the next time that date happens after today. Where the brief says "next
Saturday", "the weekend after next", "in three weeks", work it out from today's
date, which you are given, and say in unclear which date you landed on and what
words you got it from. If you cannot pin a date down to one day, leave it empty
and say so.

Times are 24-hour HH:MM. "4.30pm" is "16:30". "half seven" is not a time you can
be sure of — leave it empty and say so in unclear.

If the brief is a conversation, LATER OVERRIDES EARLIER. A chat where the
headcount goes 60, then 80, then "let's say 75 final" has a headcount of 75.
Where a change was discussed but never settled, take the last figure that was
actually agreed and put the wobble in unclear. Ignore options that were raised
and rejected: a menu that was considered and dropped is not this job's menu.

THE MENU. You are given the caterer's own recipe book as a list of names. For
each dish the brief names, copy the dish as written, and set recipe to the name
from that list if the list contains this dish — copied character for character
as it appears there. If the list does not contain it, set recipe to an empty
string. Never write a recipe name that is not in the list, not even a close
variant, and never invent one. A dish that isn't in her book is useful
information: it's the dish she still has to write up.

DIETARIES. Only use one of the allowed labels when it is exactly the
requirement. Everything else — a shellfish allergy, coeliac by name, low
FODMAP, halal, no onion — goes into otherDietaries word for word, with the
number of people if the brief gives one. Never round one requirement to another
that looks similar. A nut allergy and a sesame allergy are different
instructions to a kitchen and treating them as the same can put somebody in
hospital. Never leave a dietary out of both lists.

SHIFTS. Only days the brief actually names. If the brief says the prep starts
two days before, and gives the event date, that is a prep day you can date. If
it says nothing about prep, return no prep shift — the caterer will add her own.
Do not pad the list out to look complete.

If what you were given is not a catering brief at all, return empty strings,
zeros and empty arrays, and say in unclear what it looked like instead.`;

export async function POST(request: Request) {
  // Who before what. The key check below tells the caller something about how
  // this deployment is configured, and a stranger has no business learning it.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Reading briefs isn't switched on for this site yet — it needs an ANTHROPIC_API_KEY in the Vercel project settings. Until then, fill the job in by hand on the Event page.",
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const row = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;

  const briefText = typeof row.text === "string" ? row.text.trim() : "";
  if (briefText.length > MAX_TEXT) {
    return NextResponse.json(
      {
        error: `That's ${briefText.length.toLocaleString()} characters — longer than this reads in one go. Paste the part of the chat that's about the job.`,
      },
      { status: 400 },
    );
  }

  const pages = collectPages(Array.isArray(row.pages) ? row : { pages: [] });
  const hasPdf = pages.some((page) => page.mediaType === "application/pdf");

  // Text alone is fine, files alone are fine, both together are fine. Nothing
  // at all is not, and says so rather than sending an empty request.
  if (briefText === "" && pages.length === 0) {
    return NextResponse.json(
      { error: "Nothing came through to read. Paste the brief, or choose a file." },
      { status: 400 },
    );
  }

  if (pages.length > 0) {
    const fault = faultInPages(pages, {
      isAllowedType,
      maxBytes: hasPdf ? MAX_PDF_BYTES : MAX_IMAGE_BYTES,
    });
    if (fault) {
      const said = {
        empty: "Nothing came through to read. Paste the brief, or choose a file.",
        "too-many": `That's more files than the ${MAX_PAGES} this reads at once. Send the rest in a second go.`,
        type: "One of those files isn't something the reader can open. Use photos, a PDF, or paste the text.",
        "too-big": hasPdf
          ? "That PDF is too big to read. Send just the pages about this job."
          : "Those photos are too big altogether, even after shrinking. Send them in two goes.",
      }[fault.kind];
      return NextResponse.json({ error: said }, { status: 400 });
    }
  }

  const today =
    typeof row.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.today)
      ? row.today
      : new Date().toISOString().slice(0, 10);

  // Her recipe book, names only, scoped to her by row-level security.
  const { data: recipeRows } = await supabase
    .from("recipes")
    .select("id, name")
    .order("name")
    .limit(MAX_RECIPE_NAMES);

  const recipes = (recipeRows ?? []) as { id: string; name: string }[];
  const recipeNames = recipes.map((recipe) => recipe.name);

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 12000,
      system: SYSTEM,
      output_config: {
        // Medium rather than the low the other readers use. An invoice is a
        // table: read the rows, done. A planning chat where the headcount went
        // 60, then 80, then "75 final" and half the menu was swapped is
        // genuine reading, and landing on the last agreed figure instead of
        // the first is the whole value of the feature.
        effort: "medium",
        format: { type: "json_schema", schema: SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: [
            { type: "text" as const, text: `Today's date is ${today}.` },
            {
              type: "text" as const,
              text:
                recipeNames.length === 0
                  ? "The caterer has no recipes saved yet, so no dish can be matched to her book. Set every dish's recipe to an empty string."
                  : `The caterer's recipe book, one name per line. Match dishes only to these, copied exactly:\n${recipeNames.join("\n")}`,
            },
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
              return label ? [{ type: "text" as const, text: label }, block] : [block];
            }),
            ...(briefText === ""
              ? []
              : [{ type: "text" as const, text: `The brief:\n\n${briefText}` }]),
            { type: "text" as const, text: "Read this brief into the job." },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "Couldn't read that brief. Fill the job in by hand on the Event page." },
        { status: 422 },
      );
    }

    const text = response.content.find((block) => block.type === "text");
    if (!text) {
      return NextResponse.json(
        { error: "Couldn't read that brief. Fill the job in by hand on the Event page." },
        { status: 422 },
      );
    }

    const brief = readBrief(JSON.parse(text.text), recipeNames);

    // The library goes back with the brief so the page can turn matched dish
    // names into recipe ids without a second round trip — and so it shows the
    // same book the matching was done against, not a newer one.
    return NextResponse.json({ brief, library: recipes });
  } catch (error) {
    console.error("read-brief failed", error);
    return NextResponse.json(
      {
        error:
          "Reading briefs is unavailable right now. Fill the job in by hand on the Event page — nothing else depends on this.",
      },
      { status: 502 },
    );
  }
}
