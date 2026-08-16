import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isInvited } from "@/lib/access.ts";

/** Pages anyone can see. Everything else needs a signed-in operator. */
const PUBLIC_PATHS = ["/", "/login", "/auth", "/no-access"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Refreshes an expiring session. Must run before any auth check below —
  // don't reorder these.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const isApi = pathname.startsWith("/api/");

  if (isPublic(pathname)) return response;

  // API routes answer for themselves with a 401 and a JSON body. Redirecting
  // them to the login page would hand the caller HTML, which every fetch() in
  // this app would then fail to parse.
  if (!user) {
    if (isApi) return response;
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    // Send them back where they were headed once they're in.
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  // Signed in is not the same as allowed in. Anyone can ask for a magic link,
  // so the account only means something once the email is on the invite list.
  if (!(await isInvited(supabase))) {
    if (isApi) {
      return NextResponse.json(
        { error: "This account hasn't been invited." },
        { status: 403 },
      );
    }
    const blocked = request.nextUrl.clone();
    blocked.pathname = "/no-access";
    blocked.search = "";
    return NextResponse.redirect(blocked);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next's own assets and image files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
