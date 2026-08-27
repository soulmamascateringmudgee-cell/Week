import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import Link from "next/link";

import NavLink from "@/components/NavLink.tsx";
import SignOutButton from "@/components/SignOutButton.tsx";
import { isAdmin } from "@/lib/access.ts";
import { createClient } from "@/lib/supabase/server.ts";
import "./globals.css";

/**
 * Two faces, each doing a job the other can't.
 *
 * Fraunces carries the headings and the big figures. It's a warm, slightly
 * old-fashioned serif — the register of a good menu or a cookbook rather than
 * a dashboard, which is what this is for. `SOFT` rounds the terminals so it
 * reads friendly at the sizes we use it; `WONK` is left at 0 because its
 * swashes are charming in a logo and a distraction in a heading.
 *
 * Inter does everything you have to read carefully — form labels, order
 * quantities, prices. It's dull on purpose. Its tabular numerals are the
 * reason it's here: a column of weights that doesn't line up is a column
 * you re-read, and this app is used standing at a bench.
 *
 * Both are self-hosted by next/font at build time, so no request leaves the
 * user's browser for a font and nothing reflows once the page has painted.
 */
const display = Fraunces({
  subsets: ["latin"],
  axes: ["SOFT"],
  variable: "--font-display",
  display: "swap",
});

const text = Inter({
  subsets: ["latin"],
  variable: "--font-text",
  display: "swap",
});

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
    <html lang="en-AU" className={`${display.variable} ${text.variable}`}>
      <body>
        <header className="site">
          <div className="wrap">
            <Link href="/" className="brand">
              Prep&nbsp;&amp;&nbsp;Ordering
            </Link>
            {/* Seven links don't fit across a phone. Rather than wrap them
                into a block that shoves the page down, the row scrolls
                sideways — the same shape on every screen, and the links
                nearest the thumb are the ones used most. */}
            <nav className="modes">
              {user ? (
                <>
                  <NavLink href="/event">Event</NavLink>
                  <NavLink href="/service">Weekly service</NavLink>
                  <NavLink href="/recipes">Recipes</NavLink>
                  <NavLink href="/prices">Prices</NavLink>
                  <NavLink href="/stock">Stock</NavLink>
                  <NavLink href="/jobs">Saved jobs</NavLink>
                  {owner && (
                    <NavLink href="/admin">Who&rsquo;s allowed in</NavLink>
                  )}
                  <NavLink href="/account">Account</NavLink>
                  <SignOutButton />
                </>
              ) : (
                <NavLink href="/login">Sign in</NavLink>
              )}
            </nav>
          </div>
        </header>
        <main className="wrap">{children}</main>
        {/* Reachable from every page, signed in or not. Someone deciding
            whether to type their recipes in shouldn't have to hunt for it. */}
        <footer className="site">
          <div className="wrap">
            <Link href="/privacy">Your recipes are yours</Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
