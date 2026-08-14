import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server.ts";

/**
 * Where the emailed sign-in link lands.
 *
 * Two shapes arrive here and which one you get depends on the email template
 * in the Supabase dashboard, not on anything in this code:
 *
 *   ?code=...                    the default template, PKCE
 *   ?token_hash=...&type=...     a template customised to use {{ .TokenHash }}
 *
 * Handle both. Only reading one of them looks exactly like a broken login:
 * the email sends, the link is valid, Supabase verifies it, and the operator
 * still lands back on the sign-in page with no session and no explanation.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/jobs";

  // Only ever redirect within this app — an open redirect here would let a
  // crafted link bounce someone to another site after signing in.
  const destination = next.startsWith("/") && !next.startsWith("//")
    ? next
    : "/jobs";

  const backToLogin = (problem: string) => {
    const login = new URL("/login", origin);
    login.searchParams.set("problem", problem);
    return NextResponse.redirect(login);
  };

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(destination, origin));
    // PKCE ties the code to the browser that asked for the link, so opening
    // it somewhere else fails even though the link itself is good. That's the
    // likeliest reason to be here, and it needs saying plainly.
    return backToLogin("same-browser");
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) return NextResponse.redirect(new URL(destination, origin));
  }

  return backToLogin("expired");
}
