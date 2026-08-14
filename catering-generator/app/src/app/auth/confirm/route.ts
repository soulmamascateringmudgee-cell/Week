import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server.ts";

/** Where the emailed sign-in link lands. Verifies the token, sets the session. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/jobs";

  // Only ever redirect within this app — an open redirect here would let a
  // crafted link bounce someone to another site after signing in.
  const destination = next.startsWith("/") && !next.startsWith("//")
    ? next
    : "/jobs";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(new URL(destination, origin));
    }
  }

  const login = new URL("/login", origin);
  login.searchParams.set("expired", "1");
  return NextResponse.redirect(login);
}
