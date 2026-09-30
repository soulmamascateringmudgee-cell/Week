import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isInvited } from "@/lib/access.ts";

/**
 * Pages anyone can see. Everything else needs a signed-in operator.
 *
 * `/signup` has to be here or an invited caterer can never set a password —
 * they'd be bounced to a login page for an account that doesn't exist yet.
 * `/privacy` is public because someone deciding whether to trust this app with
 * their recipes has to be able to read it before they sign up.
 */
const PUBLIC_PATHS = ["/", "/login", "/signup", "/auth", "/no-access", "/privacy"];

/**
 * The crew's own pages, which belong to people who have no account here.
 *
 * Casual staff are not operators. They don't pay, they aren't on the invite
 * list, and they sign in with a name and four digits against their own
 * employer's crew code — so the checks below would bounce every one of them
 * to a login page for an account that will never exist.
 *
 * Only the sub-paths are open. `/crew` with nothing after it is the
 * operator's own roster page and stays behind the ordinary login, and the
 * routes under `/api/crew` do their own check: every one of them reads the
 * crew session first and answers 401 without it.
 */
function isCrewPath(pathname: string): boolean {
  return pathname.startsWith("/crew/") || pathname.startsWith("/api/crew/");
}

function isPublic(pathname: string): boolean {
  if (isCrewPath(pathname)) return true;
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
