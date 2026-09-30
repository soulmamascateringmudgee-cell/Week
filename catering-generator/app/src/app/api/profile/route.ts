import { NextResponse } from "next/server";

import { brandToStore } from "@/lib/brand.ts";
import { crewCodeFrom } from "@/lib/crew-access.ts";
import { createClient } from "@/lib/supabase/server.ts";

/**
 * The operator's own settings. Currently one: which colours the app wears.
 *
 * `brandToStore` is what stands between the request body and an attribute
 * on the html element. Anything that isn't a palette this build knows about
 * is stored as null — the plain look — rather than written through.
 */

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("brand, business_name, crew_code")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Couldn't read your settings." }, { status: 500 });
  }

  /**
   * The crew link has to exist before it can be sent to anybody, and an
   * operator shouldn't have to go and make one. It's minted the first time
   * the crew page is opened, from the business name if there is one.
   *
   * A clash is possible — two businesses with the same name — so a failure
   * to save is not an error to show. They get no link this time and one on
   * the next attempt, which appends a random tail.
   */
  let crewCode = data?.crew_code ?? null;
  if (!crewCode) {
    const candidate = crewCodeFrom(data?.business_name ?? user.email?.split("@")[0]);
    const { data: saved } = await supabase
      .from("profiles")
      .upsert({ id: user.id, crew_code: candidate }, { onConflict: "id" })
      .select("crew_code")
      .maybeSingle();
    crewCode = saved?.crew_code ?? null;
  }

  return NextResponse.json({
    brand: data?.brand ?? null,
    businessName: data?.business_name ?? null,
    crewCode,
  });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: { brand?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const brand = brandToStore(body.brand);

  // Upsert rather than update: a profile row is created on sign-up, but an
  // account that predates that trigger shouldn't silently fail to save a
  // setting it was just offered.
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, brand }, { onConflict: "id" });

  if (error) {
    return NextResponse.json({ error: "Couldn't save that." }, { status: 500 });
  }
  return NextResponse.json({ brand });
}
