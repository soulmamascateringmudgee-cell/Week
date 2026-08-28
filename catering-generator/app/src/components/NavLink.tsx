"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * A nav link that knows whether you're on it.
 *
 * The highlight comes from the URL rather than from any state the header
 * holds, so it's still right after a reload, after the back button, and on a
 * link opened straight into a new tab — all the ways a remembered "current
 * tab" quietly goes stale.
 *
 * The match is exact. A `startsWith` test would light up "Event" on every
 * page under /event, which sounds right until you notice `/` is a prefix of
 * everything and the home link glows permanently.
 */
export default function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      className={active ? "active" : undefined}
      // Colour alone can't say "you are here" — a screen reader needs telling
      // too, and so does anyone who doesn't separate sage from grey easily.
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
