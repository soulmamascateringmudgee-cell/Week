import { NextResponse } from "next/server";

import { extractRecipe } from "@/lib/recipe-import.ts";
import { createClient } from "@/lib/supabase/server.ts";

/**
 * Fetch a recipe page and pull the ingredients out of it.
 *
 * This makes the server fetch a URL somebody typed, so it is deliberately
 * fenced: signed-in callers only, http(s) only, no addresses on the local
 * network, a short timeout and a size cap. Without those, a text box on a
 * public site becomes a way to make our server knock on doors it shouldn't.
 */

const TIMEOUT_MS = 8000;
const MAX_BYTES = 3_000_000;

/** Hostnames that would point the fetch back at our own infrastructure. */
function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host.endsWith(".local")
  ) {
    return true;
  }
  // IPv4 literals in the private and loopback ranges.
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true; // cloud metadata
    return false;
  }
  // IPv6 loopback and link/unique-local.
  if (host === "::1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) {
    return true;
  }
  return false;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let raw: string;
  try {
    const body = (await request.json()) as { url?: unknown };
    raw = typeof body.url === "string" ? body.url.trim() : "";
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return NextResponse.json(
      { error: "That doesn't look like a web address." },
      { status: 400 },
    );
  }

  if (target.protocol !== "https:" && target.protocol !== "http:") {
    return NextResponse.json(
      { error: "Only web addresses can be read." },
      { status: 400 },
    );
  }
  if (isPrivateHost(target.hostname)) {
    return NextResponse.json(
      { error: "That address can't be read from here." },
      { status: 400 },
    );
  }

  let html: string;
  try {
    const response = await fetch(target, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        // Some sites serve a stripped page to anything that looks like a bot,
        // and the JSON-LD block is exactly what gets stripped.
        "user-agent":
          "Mozilla/5.0 (compatible; PrepAndOrdering/1.0; recipe importer)",
        accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `That page wouldn't load (${response.status}). Some sites block this — copy the ingredients and paste them instead.`,
        },
        { status: 422 },
      );
    }

    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > MAX_BYTES) {
      return NextResponse.json(
        { error: "That page is too big to read." },
        { status: 422 },
      );
    }

    html = (await response.text()).slice(0, MAX_BYTES);
  } catch {
    return NextResponse.json(
      {
        error:
          "Couldn't reach that page. Check the address, or copy the ingredients and paste them instead.",
      },
      { status: 422 },
    );
  }

  const recipe = extractRecipe(html);
  if (!recipe) {
    return NextResponse.json(
      {
        error:
          "No recipe found on that page. Plenty of blogs don't publish one a computer can read — copy the ingredient list and paste it into the box instead.",
      },
      { status: 422 },
    );
  }

  return NextResponse.json({ recipe, source: target.toString() });
}
