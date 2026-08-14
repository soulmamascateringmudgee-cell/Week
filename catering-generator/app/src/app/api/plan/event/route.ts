import { NextResponse } from "next/server";

import { planEvent } from "@/lib/event-engine.ts";
import type { EventInput } from "@/lib/types.ts";

export async function POST(request: Request) {
  let input: EventInput;
  try {
    input = (await request.json()) as EventInput;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  try {
    return NextResponse.json(planEvent(input));
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
