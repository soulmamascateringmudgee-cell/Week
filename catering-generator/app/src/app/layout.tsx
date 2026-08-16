import type { Metadata } from "next";
import Link from "next/link";

import SignOutButton from "@/components/SignOutButton.tsx";
import { isAdmin } from "@/lib/access.ts";
import { createClient } from "@/lib/supabase/server.ts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prep & Ordering",
  description:
    "Turns a menu and a number of people into quantities you can order.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const owner = user ? await isAdmin(supabase) : false;

  return (
    <html lang="en-AU">
      <body>
        <header className="site">
          <div className="wrap">
            <Link href="/" className="brand">
              Prep&nbsp;&amp;&nbsp;Ordering
            </Link>
            <nav className="modes">
              {user ? (
                <>
                  <Link href="/event">Event</Link>
                  <Link href="/service">Weekly service</Link>
                  <Link href="/recipes">Recipes</Link>
                  <Link href="/prices">Prices</Link>
                  <Link href="/jobs">Saved jobs</Link>
                  {owner && <Link href="/admin">Who&rsquo;s allowed in</Link>}
                  <SignOutButton />
                </>
              ) : (
                <Link href="/login">Sign in</Link>
              )}
            </nav>
          </div>
        </header>
        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}
