import { NextResponse } from "next/server";

import { planService } from "@/lib/par-engine.ts";
import type { ServiceInput } from "@/lib/types.ts";

export async function POST(request: Request) {
  let input: ServiceInput;
  try {
    input = (await request.json()) as ServiceInput;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  try {
    return NextResponse.json(planService(input));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Couldn't build the par levels from those details.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
