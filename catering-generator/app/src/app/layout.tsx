import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prep & Ordering",
  description:
    "Turns a menu and a number of people into quantities you can order.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-AU">
      <body>
        <header className="site">
          <div className="wrap">
            <Link href="/" className="brand">
              Prep&nbsp;&amp;&nbsp;Ordering
            </Link>
            <nav className="modes">
              <Link href="/event">Event</Link>
              <Link href="/service">Weekly service</Link>
            </nav>
          </div>
        </header>
        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}
